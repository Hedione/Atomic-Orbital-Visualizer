import { ArrowLeft, ArrowRight, Minus, Plus, SlidersHorizontal } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { adjacentOrbital, clampOrbital, HIGH_N_LIMIT, LOW_N_LIMIT, orbitalLabel, realOrbitalCombination, realOrbitalLabel, sameOrbital, secondOrbital } from '../physics/hydrogen'
import { defaultSettings, type Orbital, type Settings } from '../types'
import { QUANTUM_TIME_SCALE, type QuantumTimeline } from '../physics/evolution'
import { QuantumTime } from './QuantumTime'
import { CoherentTransition } from './CoherentTransition'
import { defaultRabiFrequency, polarizationFor } from '../physics/transition'
import { MathText, OrbitalText, PermanentControlSection, Range, Reveal, Stepper, Toggle } from './UI'

export type UpdateSettings = <K extends keyof Settings>(key: K, value: Settings[K]) => void
type QuantumSelection = Pick<Settings, 'n' | 'l' | 'm' | 'n2' | 'l2' | 'm2' | 'highN' | 'superposition' | 'orbitalBasis'>
export function Controls({ settings: s, update, setState, timeline, transitionAcknowledged, acknowledgeTransition }: {
  settings: Settings; update: UpdateSettings; setState: (o: Orbital) => void; timeline?: QuantumTimeline;
  transitionAcknowledged: boolean; acknowledgeTransition: () => void;
}) {
  const noticeButton = useRef<HTMLButtonElement>(null), modeButton = useRef<HTMLButtonElement>(null)
  const showNotice = s.coherentTransition && !transitionAcknowledged
  useEffect(() => { if (showNotice) noticeButton.current?.focus() }, [showNotice])
  const maximum = s.highN && !s.coherentTransition ? HIGH_N_LIMIT : LOW_N_LIMIT
  const snapshot = () => ({ n: s.n, l: s.l, m: s.m, n2: s.n2, l2: s.l2, m2: s.m2, highN: s.highN, superposition: s.superposition, orbitalBasis: s.orbitalBasis })
  const previousLow = useRef<QuantumSelection>(snapshot()), staticState = useRef<QuantumSelection>(snapshot())
  const latestUpdate = useRef(update); latestUpdate.current = update
  useLayoutEffect(() => {
    if (s.coherentTransition) latestUpdate.current('rabiFrequency', defaultRabiFrequency(s))
  }, [s.coherentTransition, s.n, s.l, s.m, s.n2, s.l2, s.m2])
  const resetTransition = () => { update('transitionPlaying', false); update('transitionProgress', 0); update('transitionRun', s.transitionRun + 1) }
  const setSecond = (o: Orbital) => { update('n2', o.n); update('l2', o.l); update('m2', o.m) }
  const selectTransition = (deltaL: number, deltaM: number, n2 = s.n2, initial: Orbital = s) => {
    const l2 = Math.max(0, Math.min(n2 - 1, initial.l + deltaL))
    const m2 = l2 === 0 ? 0 : Math.max(-l2, Math.min(l2, initial.m + deltaM))
    setSecond({ n: n2, l: l2, m: m2 }); update('polarization', polarizationFor(m2 - initial.m)); resetTransition()
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
    setState({ n: o.n, l: o.l, m: o.m }); setSecond(secondOrbital(o)); update('highN', o.highN); update('superposition', o.superposition)
    update('orbitalBasis', o.orbitalBasis)
  }
  const setHighN = (enabled: boolean) => {
    if (s.coherentTransition) return
    if (enabled) previousLow.current = snapshot()
    else { const o = previousLow.current; setState({ n: o.n, l: o.l, m: o.m }); setSecond(secondOrbital(o)) }
    update('highN', enabled)
  }
  const randomState = (): Orbital => { const n = 1 + Math.floor(Math.random() * maximum), l = Math.floor(Math.random() * n); return { n, l, m: Math.floor(Math.random() * (2 * l + 1)) - l } }
  const randomize = () => {
    const first = randomState(); setState(first)
    if (s.coherentTransition) {
      const options: Orbital[] = []
      for (let n = 1; n <= maximum; n++) for (const l of [first.l - 1, first.l + 1]) for (const deltaM of [-1, 0, 1]) {
        const m = first.m + deltaM
        if (n !== first.n && l >= 0 && l < n && Math.abs(m) <= l) options.push({ n, l, m })
      }
      const second = options[Math.floor(Math.random() * options.length)]
      setSecond(second); update('polarization', polarizationFor(second.m - first.m)); resetTransition()
    } else if (s.superposition) setSecond(randomState())
  }
  const switchMode = () => {
    resetTransition()
    if (!s.coherentTransition) {
      staticState.current = snapshot()
      setState({ n: 1, l: 0, m: 0 }); setSecond({ n: 2, l: 1, m: 0 })
      update('highN', false); update('superposition', false); update('polarization', 'pi'); update('drivePhase', 0)
      update('orbitalBasis', 'complex')
    } else restore(staticState.current)
    update('coherentTransition', !s.coherentTransition)
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
  const caption = (o: Orbital, second = false) => <div className="orbital-caption">
    <span className="orbital-name" data-testid={second ? 'second-orbital-label' : 'orbital-label'}><OrbitalText>{orbitalLabel(o, s.orbitalBasis)}</OrbitalText></span>
    {s.orbitalBasis === 'real' && <span className="real-orbital-combination option-reveal" data-testid={second ? 'second-real-orbital-combination' : 'real-orbital-combination'}><MathText block>{realOrbitalCombination(o)}</MathText></span>}
  </div>
  const navigation = <div className="state-navigation"><div className="state-navigation-half"><button type="button" className="state-step" onClick={() => selectPrimary(adjacentOrbital(s, -1, maximum))}><ArrowLeft size={11} /> Previous</button><button type="button" className="randomize-state" onClick={randomize}>Randomize</button></div><div className="state-navigation-half"><Toggle label="Explore high n" checked={s.highN && !s.coherentTransition} onChange={setHighN} showState={false} disabled={s.coherentTransition} /><button type="button" className="state-step" onClick={() => selectPrimary(adjacentOrbital(s, 1, maximum))}>Next <ArrowRight size={11} /></button></div></div>
  return <aside id="simulation-controls" className="controls-panel" aria-label="Simulation controls">
    <div className="panel-heading"><SlidersHorizontal size={15} /><span>EXPERIMENT CONTROLS</span></div>
    <PermanentControlSection title="Quantum state" eyebrow="01" action={<button ref={modeButton} type="button" className="quantum-mode-switch" aria-controls="quantum-mode-controls" onClick={switchMode}>Switch to {s.coherentTransition ? 'Static' : 'Transition'} mode</button>}>
      <div id="quantum-mode-controls" data-mode={s.coherentTransition ? 'transition' : 'static'}>
        <div className="orbital-basis-control"><Toggle label="Real orbital combinations" checked={s.orbitalBasis === 'real'} onChange={real => update('orbitalBasis', real ? 'real' : 'complex')} disabled={s.coherentTransition} hint={s.coherentTransition ? 'Transitions use Lz eigenfunctions.' : s.orbitalBasis === 'real' ? <>Real orbitals: <OrbitalText>p_x</OrbitalText>, <OrbitalText>p_y</OrbitalText>, <OrbitalText>p_z</OrbitalText> and higher harmonics.</> : 'Current basis: complex Lz eigenfunctions.'} /></div>
        <Reveal show={!s.coherentTransition}>
          {editor(s)}{navigation}
          {caption(s)}
          <div className="evolution-playback-control"><Range label="Evolution playback speed" value={s.quantumPlayback} resetValue={1} min={0.01} max={100} step={0.01} display={`${Number(s.quantumPlayback.toFixed(2))}×`} logarithmic disabled={!s.timeEvolution} onChange={value => update('quantumPlayback', value)} physicalValue={`${Number((QUANTUM_TIME_SCALE * s.quantumPlayback * 1e15).toPrecision(4))} fs/s`} companion={<Toggle label="Evolve in time" checked={s.timeEvolution} onChange={value => update('timeEvolution', value)} showState={false} />} />
          {timeline && <QuantumTime timeline={timeline} />}</div>
          <div className="quantum-superposition"><Toggle label="Superposition mode" checked={s.superposition} onChange={value => update('superposition', value)} />
            <fieldset className="secondary-state-controls" data-testid="superposition-controls" aria-label="Second state" disabled={!s.superposition}><p className="field-caption superposition-caption">SECOND STATE</p>{editor(secondOrbital(s), true, !s.superposition)}
            {s.superposition && caption(secondOrbital(s), true)}
            {s.superposition && sameOrbital(s, secondOrbital(s)) && <p className="control-note">Identical states normalize to one eigenstate.</p>}</fieldset>
          </div>
        </Reveal>
        <Reveal show={s.coherentTransition}>
          <div className={`transition-gate${showNotice ? ' awaiting-acknowledgement' : ''}`}>
            <div className="transition-gate-content" inert={showNotice} aria-hidden={showNotice || undefined}>
              <CoherentTransition settings={s} update={update} timeline={timeline} maximum={maximum} selectTransition={selectTransition} initialControls={<>{editor(s)}{navigation}</>} />
            </div>
            {showNotice && <section className="transition-notice" aria-labelledby="transition-notice-title"><h3 id="transition-notice-title">Visual model only</h3><p id="transition-notice-copy">An ideal resonant two-state model of hydrogen. Coupling is exaggerated for visibility; spontaneous emission, spin, and fine structure are omitted.</p><button ref={noticeButton} type="button" aria-describedby="transition-notice-copy" onClick={() => { acknowledgeTransition(); modeButton.current?.focus() }}>I understand</button></section>}
          </div>
        </Reveal>
      </div>
    </PermanentControlSection>
  </aside>
}
