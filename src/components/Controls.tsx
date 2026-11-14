import { ArrowLeft, ArrowRight, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { adjacentOrbital, clampOrbital, HIGH_N_LIMIT, LOW_N_LIMIT, realOrbitalLabel, sameOrbital, secondOrbital } from '../physics/hydrogen'
import { defaultSettings, type Orbital, type OrbitalBasis, type Settings, type SimulationMode } from '../types'
import { QUANTUM_TIME_SCALE, type QuantumTimeline } from '../physics/evolution'
import { QuantumTime } from './QuantumTime'
import { CoherentTransition } from './CoherentTransition'
import { defaultRabiFrequency, polarizationForTransition } from '../physics/transition'
import { MODE_LABELS, ModePicker } from './ModePicker'
import { OrbitalText, Range, Reveal, Stepper, Toggle } from './UI'
import { FieldShiftControls } from './FieldShiftModule'

export type UpdateSettings = <K extends keyof Settings>(key: K, value: Settings[K]) => void
type WorkingMode = Exclude<SimulationMode, 'fields'>
type QuantumSelection = Pick<Settings, 'n' | 'l' | 'm' | 'n2' | 'l2' | 'm2' | 'highN' | 'superpositionMix' | 'superpositionPhase' | 'orbitalBasis' | 'timeEvolution' | 'quantumPlayback'>
export function Controls({ settings: s, update, setState, timeline, transitionAcknowledged, acknowledgeTransition }: {
  settings: Settings; update: UpdateSettings; setState: (o: Orbital) => void; timeline?: QuantumTimeline;
  transitionAcknowledged: boolean; acknowledgeTransition: () => void;
}) {
  const noticeButton = useRef<HTMLButtonElement>(null)
  const showNotice = s.coherentTransition && !transitionAcknowledged
  useEffect(() => { if (showNotice) noticeButton.current?.focus() }, [showNotice])
  const maximum = s.highN && !s.coherentTransition ? HIGH_N_LIMIT : LOW_N_LIMIT
  const snapshot = (): QuantumSelection => ({ n: s.n, l: s.l, m: s.m, n2: s.n2, l2: s.l2, m2: s.m2, highN: s.highN, superpositionMix: s.superpositionMix, superpositionPhase: s.superpositionPhase, orbitalBasis: s.orbitalBasis, timeEvolution: s.timeEvolution, quantumPlayback: s.quantumPlayback })
  const savedModes = useRef<Partial<Record<WorkingMode, QuantumSelection>>>({ [s.mode]: snapshot() })
  const previousLow = useRef({ static: snapshot(), superposition: snapshot() }), calibratedTransition = useRef('')
  const latestUpdate = useRef(update); latestUpdate.current = update
  useLayoutEffect(() => {
    if (!s.coherentTransition) return
    const selection = [s.n, s.l, s.m, s.n2, s.l2, s.m2].join(':')
    if (selection !== calibratedTransition.current) {
      calibratedTransition.current = selection
      latestUpdate.current('rabiFrequency', defaultRabiFrequency(s))
    }
  }, [s.coherentTransition, s.n, s.l, s.m, s.n2, s.l2, s.m2])
  const resetTransition = () => { update('transitionPlaying', false); update('transitionProgress', 0); update('transitionRun', s.transitionRun + 1) }
  const setSecond = (o: Orbital) => { update('n2', o.n); update('l2', o.l); update('m2', o.m) }
  const selectTransition = (deltaL: number, deltaM: number, n2 = s.n2, initial: Orbital = s, orbitalBasis = s.orbitalBasis) => {
    const l2 = Math.max(0, Math.min(n2 - 1, initial.l + deltaL))
    const change = orbitalBasis === 'real' ? deltaM : Math.max(-1, Math.min(1, deltaM))
    let m2 = l2 === 0 ? 0 : Math.max(-l2, Math.min(l2, initial.m + change))
    const candidate = (m: number) => ({ ...s, ...initial, n2, l2, m2: m, orbitalBasis })
    if (orbitalBasis === 'real' && !polarizationForTransition(candidate(m2))) {
      m2 = Array.from({ length: 2 * l2 + 1 }, (_, i) => i - l2).find(m => polarizationForTransition(candidate(m))) ?? m2
    }
    setSecond({ n: n2, l: l2, m: m2 }); update('polarization', polarizationForTransition(candidate(m2)) ?? 'pi'); resetTransition()
  }
  const setBasis = (orbitalBasis: OrbitalBasis) => {
    update('orbitalBasis', orbitalBasis)
    if (s.coherentTransition) selectTransition(s.l2 - s.l, s.m2 - s.m, s.n2, s, orbitalBasis)
  }
  const selectPrimary = (o: Orbital) => {
    const next = clampOrbital(o, maximum)
    setState(next)
    if (s.coherentTransition) {
      let delta = s.l2 - s.l
      if (next.l + delta < 0 || next.l + delta >= s.n2) delta = next.l > 0 ? -1 : 1
      const n2 = Math.max(s.n2, next.l + delta + 1)
      selectTransition(delta, s.m2 - s.m, Math.min(maximum, n2), next)
    }
  }
  const restore = (o: QuantumSelection) => {
    setState({ n: o.n, l: o.l, m: o.m }); setSecond(secondOrbital(o)); update('highN', o.highN)
    update('orbitalBasis', o.orbitalBasis); update('superpositionMix', o.superpositionMix)
    update('superpositionPhase', o.superpositionPhase ?? defaultSettings.superpositionPhase)
    update('timeEvolution', o.timeEvolution); update('quantumPlayback', o.quantumPlayback)
  }
  const setHighN = (enabled: boolean) => {
    if (s.mode !== 'static' && s.mode !== 'superposition') return
    if (enabled) previousLow.current[s.mode] = snapshot()
    else { const o = previousLow.current[s.mode]; setState({ n: o.n, l: o.l, m: o.m }); setSecond(secondOrbital(o)) }
    update('highN', enabled)
  }
  const randomState = (): Orbital => { const n = 1 + Math.floor(Math.random() * maximum), l = Math.floor(Math.random() * n); return { n, l, m: Math.floor(Math.random() * (2 * l + 1)) - l } }
  const randomize = () => {
    const first = randomState(); setState(first)
    if (s.coherentTransition) {
      const options: Orbital[] = []
      for (let n = 1; n <= maximum; n++) for (const l of [first.l - 1, first.l + 1]) {
        if (n === first.n || l < 0 || l >= n) continue
        for (let m = -l; m <= l; m++) {
          if (polarizationForTransition({ ...s, ...first, n2: n, l2: l, m2: m })) options.push({ n, l, m })
        }
      }
      const second = options[Math.floor(Math.random() * options.length)]
      setSecond(second); update('polarization', polarizationForTransition({ ...s, ...first, n2: second.n, l2: second.l, m2: second.m })!); resetTransition()
    } else if (s.superposition) setSecond(randomState())
  }
  const switchMode = (mode: SimulationMode) => {
    if (mode === s.mode) return
    if (s.mode !== 'fields') savedModes.current[s.mode] = snapshot()
    resetTransition()
    if (mode !== 'fields') {
      const saved = savedModes.current[mode]
      if (saved) restore(saved)
      else if (mode === 'transition') {
        restore({ ...defaultSettings, orbitalBasis: s.orbitalBasis, n2: 3, l2: 2, m2: 0 })
        update('polarization', 'pi'); update('drivePhase', 0)
      } else {
        restore(savedModes.current.static ?? defaultSettings)
        previousLow.current[mode] = { ...previousLow.current.static }
      }
    }
    update('superposition', mode === 'superposition'); update('coherentTransition', mode === 'transition'); update('mode', mode)
  }
  const editor = (o: Orbital, second = false, disabled = false) => {
    const change = (patch: Partial<Orbital>) => { const next = clampOrbital({ ...o, ...patch }, maximum); if (second) setSecond(next); else selectPrimary(next) }
    return <div className="state-steppers hydrogen-steppers">
      {([['n', 'n', 1, maximum], ['l', 'ℓ', 0, o.n - 1], ['m', 'mℓ', o.l === 0 ? 0 : -o.l, o.l]] as const).map(([key, label, min, max]) =>
        <div key={key} className="quantum-control">{key === 'm' && s.orbitalBasis === 'real' ? <div className="stepper orbital-choice"><span className="orbital-choice-label">Orbital</span><div>
          <button type="button" aria-label={second ? 'Previous second orbital' : 'Previous orbital'} disabled={disabled || o.m <= min} onClick={() => change({ m: o.m - 1 })}><Minus size={14} /></button>
          <output aria-label={second ? 'Second orbital selection' : 'Orbital selection'}><span><OrbitalText>{realOrbitalLabel(o.l, o.m)}</OrbitalText></span></output>
          <button type="button" aria-label={second ? 'Next second orbital' : 'Next orbital'} disabled={disabled || o.m >= max} onClick={() => change({ m: o.m + 1 })}><Plus size={14} /></button>
        </div></div> : <Stepper label={label} ariaLabel={second ? `Second ${label}` : label} value={o[key]} min={min} max={max} onChange={value => change({ [key]: value })} disabled={disabled} />}
        <Range label={key === 'm' && s.orbitalBasis === 'real' ? second ? 'Second orbital' : 'Orbital' : second ? `Second ${label}` : label} value={o[key]} resetValue={Math.min(max, Math.max(min, (second ? secondOrbital(defaultSettings) : defaultSettings)[key]))} min={min} max={max} logarithmic={false} onChange={value => change({ [key]: value })} disabled={disabled || min === max} display={key === 'm' && s.orbitalBasis === 'real' ? realOrbitalLabel(o.l, o.m).replace('_', ' ') : undefined} minLabel={key === 'm' && s.orbitalBasis === 'real' ? <OrbitalText>{realOrbitalLabel(o.l, min)}</OrbitalText> : undefined} maxLabel={key === 'm' && s.orbitalBasis === 'real' ? <OrbitalText>{realOrbitalLabel(o.l, max)}</OrbitalText> : undefined} hideLabel /></div>)}
    </div>
  }
  const navigation = <div className="state-navigation"><div className="state-navigation-half"><button type="button" className="state-step" onClick={() => selectPrimary(adjacentOrbital(s, -1, maximum))}><ArrowLeft size={11} /> Previous</button><button type="button" className="randomize-state" onClick={randomize}>Randomize</button></div><div className="state-navigation-half"><Toggle label="Explore high n" checked={s.highN && !s.coherentTransition} onChange={setHighN} showState={false} disabled={s.coherentTransition} /><button type="button" className="state-step" onClick={() => selectPrimary(adjacentOrbital(s, 1, maximum))}>Next <ArrowRight size={11} /></button></div></div>
  const duplicate = sameOrbital(s, secondOrbital(s))
  const phaseDegrees = Math.round(s.superpositionPhase * 180 / Math.PI)
  return <aside id="simulation-controls" className="controls-panel" aria-label="Simulation controls">
    <div className="panel-heading"><SlidersHorizontal size={15} /><span>EXPERIMENT CONTROLS</span></div>
    <ModePicker mode={s.mode} onSelect={switchMode} />
    <section className="control-section mode-controls" aria-label={MODE_LABELS[s.mode]}><div className="section-body">
      <div key={s.mode} id="quantum-mode-controls" className="option-reveal mode-module" data-mode={s.mode}>
        {s.mode !== 'fields' && <div className="orbital-basis-control"><Toggle label="Real orbital combinations" checked={s.orbitalBasis === 'real'} onChange={real => setBasis(real ? 'real' : 'complex')} hint={s.orbitalBasis === 'real' ? <>Real orbitals: <OrbitalText>p_x</OrbitalText>, <OrbitalText>p_y</OrbitalText>, <OrbitalText>p_z</OrbitalText> and higher harmonics.</> : 'Current basis: complex Lz eigenfunctions.'} /></div>}
        <Reveal show={s.mode === 'fields'}><FieldShiftControls settings={s.fieldShift} onChange={value => update('fieldShift', value)} /></Reveal>
        <Reveal show={s.mode === 'static' || s.mode === 'superposition'}>
          {s.mode === 'superposition' && <p className="field-caption superposition-caption">FIRST STATE</p>}
          {editor(s)}{navigation}
          <Reveal show={s.mode === 'superposition'}><div className="quantum-superposition">
            <fieldset className="secondary-state-controls" data-testid="superposition-controls" aria-label="Second state"><p className="field-caption superposition-caption">SECOND STATE</p>{editor(secondOrbital(s), true)}
            {duplicate && <p className="control-note">Identical states normalize to one eigenstate.</p>}</fieldset>
            <Range label="State mix" value={s.superpositionMix * 100} resetValue={50} min={0} max={100} step={1} logarithmic={false} display={`${Math.round((1 - s.superpositionMix) * 100)}% / ${Math.round(s.superpositionMix * 100)}%`} minLabel="State 1" maxLabel="State 2" onChange={value => update('superpositionMix', value / 100)} />
            <Range label="Phase offset" value={phaseDegrees} resetValue={0} min={-180} max={180} step={1} logarithmic={false} display={`${phaseDegrees}°`} minLabel="−180°" maxLabel="180°" disabled={duplicate} onChange={value => update('superpositionPhase', value * Math.PI / 180)} hint={duplicate ? 'Relative phase is undefined for identical states.' : undefined} />
          </div></Reveal>
          <div className="evolution-playback-control"><Range label="Evolution playback speed" value={s.quantumPlayback} resetValue={1} min={0.01} max={100} step={0.01} display={`${Number(s.quantumPlayback.toFixed(2))}×`} logarithmic disabled={!s.timeEvolution} onChange={value => update('quantumPlayback', value)} physicalValue={`${Number((QUANTUM_TIME_SCALE * s.quantumPlayback * 1e15).toPrecision(4))} fs/s`} companion={<Toggle label="Evolve in time" checked={s.timeEvolution} onChange={value => update('timeEvolution', value)} showState={false} />} />
          {timeline && <QuantumTime timeline={timeline} />}</div>
        </Reveal>
        <Reveal show={s.mode === 'transition'}>
          <div className={`transition-gate${showNotice ? ' awaiting-acknowledgement' : ''}`}>
            <div className="transition-gate-content" inert={showNotice} aria-hidden={showNotice || undefined}>
              <CoherentTransition settings={s} update={update} timeline={timeline} maximum={maximum} selectTransition={selectTransition} initialControls={<>{editor(s)}{navigation}</>} />
            </div>
            {showNotice && <section className="transition-notice" aria-labelledby="transition-notice-title"><h3 id="transition-notice-title">Visual model only</h3><p id="transition-notice-copy">An ideal resonant two-state model of hydrogen. Coupling is exaggerated for visibility; spontaneous emission, spin, and fine structure are omitted.</p><button ref={noticeButton} type="button" aria-describedby="transition-notice-copy" onClick={() => { acknowledgeTransition(); document.getElementById('simulation-controls')?.querySelector<HTMLButtonElement>('.mode-picker-trigger')?.focus() }}>I understand</button></section>}
          </div>
        </Reveal>
      </div>
    </div></section>
  </aside>
}
