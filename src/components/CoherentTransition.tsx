import { useEffect, useState, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import type { QuantumTimeline } from '../physics/evolution'
import { linearPolarizationAxis, polarizationForTransition, transitionRates, transitionTimeScale, validateTransition } from '../physics/transition'
import { orbitalLabel, realOrbitalLabel, secondOrbital } from '../physics/hydrogen'
import { defaultSettings, type Settings } from '../types'
import type { UpdateSettings } from './Controls'
import { MathText, OrbitalText, Range, SIValue } from './UI'

/** Subscribe only the readouts; animation never updates application Settings. */
export function useQuantumFrame(timeline?: QuantumTimeline) {
  const [frame, setFrame] = useState(() => timeline?.frame)
  useEffect(() => {
    if (!timeline) return
    let handle = 0, previous = -Infinity
    const tick = (now: number) => {
      if (now - previous >= 33) { previous = now; setFrame(timeline.read(now)) }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [timeline])
  return frame
}

export function CoherentTransition({ settings: s, update, timeline, maximum, selectTransition, initialControls }: { settings: Settings; update: UpdateSettings; timeline?: QuantumTimeline; maximum: number; selectTransition: (deltaL: number, deltaM: number, n2?: number) => void; initialControls: ReactNode }) {
  const frame = useQuantumFrame(timeline)
  const validation = validateTransition(s), progress = frame?.progress ?? 0
  const finalPopulation = s.transitionLoop ? Math.sin(Math.PI * progress) ** 2 : progress === 1 ? 1 : Math.sin(Math.PI * progress / 2) ** 2
  const populations = { first: 1 - finalPopulation, second: finalPopulation }
  const finished = !s.transitionLoop && progress >= 1
  const running = s.transitionPlaying && !finished && validation.allowed
  const transportLabel = finished ? 'Replay transition' : running ? 'Pause transition' : progress > 0 ? 'Resume transition' : 'Play transition'
  const rates = transitionRates(s), scale = transitionTimeScale(s)
  const reset = (play: boolean) => { update('transitionProgress', 0); update('transitionRun', s.transitionRun + 1); update('transitionPlaying', play) }
  const carrierAngularRate = Math.abs(rates.resonance) / 1e12
  const rabiMultiple = Number((s.rabiFrequency / (carrierAngularRate || 1)).toPrecision(12))
  const real = s.orbitalBasis === 'real', axis = linearPolarizationAxis(s.polarization)
  const orbitalRows = `repeat(${Math.ceil((2 * s.l2 + 1) / 3)}, 36px)`
  const degenerate = s.n === s.n2
  return <div className="coherent-controls" data-testid="coherent-controls">
    <p className="field-caption">INITIAL STATE</p>
    {initialControls}
    <section className="transition-selection" aria-label="Final state and selection rules">
      <p className="field-caption">FINAL PRINCIPAL QUANTUM NUMBER</p>
      <div className="transition-choices transition-n-choices" role="group" aria-label="Final principal quantum number">
        {Array.from({ length: maximum }, (_, i) => i + 1).map(n => <button key={n} type="button" aria-label={`Final n = ${n}`} aria-pressed={s.n2 === n} onClick={() => selectTransition(s.l < n - 1 ? 1 : -1, s.m2 - s.m, n)}>{n}</button>)}
      </div>
      <fieldset className="transition-options" disabled={degenerate} aria-label="Transition selections">
      <p className="field-caption transition-rule">{real ? 'TRANSITION · Δℓ = ±1 · REAL ORBITAL COUPLING' : 'TRANSITION · Δℓ = ±1 · Δmℓ = 0, ±1'}</p>
      <div className="transition-choices" role="group" aria-label="Change in ℓ">
        {[1, -1].map(delta => <button key={delta} type="button" aria-pressed={s.l2 - s.l === delta} disabled={s.l + delta < 0 || s.l + delta >= s.n2} onClick={() => selectTransition(delta, s.m2 - s.m)}>Δℓ = {delta > 0 ? '+1' : '−1'}</button>)}
      </div>
      {real ? <div className="transition-choices transition-m-choices" style={{ gridTemplateRows: orbitalRows }} role="group" aria-label="Final real orbital">
        {Array.from({ length: 2 * s.l2 + 1 }, (_, i) => i - s.l2).map(m => {
          const polarization = polarizationForTransition({ ...s, m2: m }), label = realOrbitalLabel(s.l2, m)
          return <button key={m} type="button" aria-label={`Final orbital ${label.replace('_', ' ')}`} aria-pressed={s.m2 === m} disabled={!polarization} title={polarization ? `Linear ${linearPolarizationAxis(polarization)} polarization` : 'Electric-dipole coupling vanishes for this orbital pair'} onClick={() => selectTransition(s.l2 - s.l, m - s.m)}><OrbitalText>{label}</OrbitalText></button>
        })}
      </div> : <div className="transition-choices transition-m-choices" style={{ gridTemplateRows: orbitalRows }} role="group" aria-label="Change in mℓ">
        {[1, 0, -1].map(delta => <button key={delta} type="button" aria-pressed={s.m2 - s.m === delta} disabled={Math.abs(s.m + delta) > s.l2} onClick={() => selectTransition(s.l2 - s.l, delta)}>Δm<sub>ℓ</sub> = {delta > 0 ? '+1' : delta < 0 ? '−1' : '0'}</button>)}
      </div>}
      <div className="transition-result" data-testid="transition-result" data-l={s.l2} data-m={s.m2} data-polarization={s.polarization}>
        <strong title={axis ? `Linear ${axis}` : 'Circular xy'}>{real ? `Linear ${axis ?? '—'}` : s.polarization === 'pi' ? 'π' : s.polarization === 'sigmaPlus' ? 'σ+' : 'σ−'}</strong>
        <span>Final state {real ? <OrbitalText>{orbitalLabel(secondOrbital(s), 'real')}</OrbitalText> : <MathText>{String.raw`\lvert n=${s.n2},\,\ell=${s.l2},\,m_\ell=${s.m2}\rangle`}</MathText>}</span>
      </div>
      </fieldset>
    </section>
    {!validation.allowed && <p className="transition-validation forbidden" role="status" data-testid="transition-validation">{validation.reason}</p>}
    <fieldset className="transition-execution" disabled={degenerate} aria-label="Transition playback controls">
    <div className="transition-transport">
      <button type="button" className="chip transition-playback" aria-label={transportLabel} title={transportLabel} disabled={!validation.allowed} onClick={() => finished ? reset(true) : update('transitionPlaying', !running)}>{running ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}</button>
      <button type="button" className="transition-loop" aria-label="Loop mode" aria-pressed={s.transitionLoop} title="Repeat initial → final → initial. Changing loop mode resets the transition." onClick={() => { update('transitionLoop', !s.transitionLoop); reset(false) }}>Loop mode {s.transitionLoop ? 'ON' : 'OFF'}</button>
      <button type="button" className="chip" onClick={() => reset(false)}>Reset transition</button>
    </div>
    <Range label="Rabi Ω : light ω multiple" value={rabiMultiple} resetValue={0.1} min={0.001} max={1} step="any" display={`${Number(rabiMultiple.toPrecision(3))}×`} physicalValue={<SIValue value={s.rabiFrequency * 1e12 / (2 * Math.PI)} unit="Hz" />} logarithmic onChange={value => update('rabiFrequency', value * carrierAngularRate)} />
    <Range label="Playback speed" value={s.transitionPlayback} resetValue={defaultSettings.transitionPlayback} min={0.1} max={10} step={0.001} display={`${s.transitionPlayback}×`} onChange={value => update('transitionPlayback', value)} physicalValue={`${Number((scale * 1e15).toPrecision(4)).toLocaleString('en-US', { maximumSignificantDigits: 4 })} fs/s`} />
    <Range label={s.transitionLoop ? 'Rabi cycle phase' : 'π-pulse progress'} value={progress * (s.transitionLoop ? 360 : 100)} resetValue={0} min={0} max={s.transitionLoop ? 360 : 100} step={0.1} display={s.transitionLoop ? `${(progress * 360).toFixed(1)}°` : `${(progress * 100).toFixed(1)}%`} minLabel={s.transitionLoop ? '0°' : undefined} maxLabel={s.transitionLoop ? '360°' : undefined} disabled={!validation.allowed} onChange={value => { update('transitionPlaying', false); update('transitionProgress', value / (s.transitionLoop ? 360 : 100)); update('transitionRun', s.transitionRun + 1) }} />
    {s.ensemblePaused && validation.allowed && <p className="control-note">Sampling is paused; resume sampling to advance the shared quantum clock. Scrubbing remains available.</p>}
    <div className="transition-populations" data-testid="transition-populations" data-progress={progress} data-time={frame?.time ?? 0}>
      {([['Initial', populations.first], ['Final', populations.second]] as const).map(([name, value]) => <div key={name}><label>{name} <output>{(value * 100).toFixed(1)}%</output></label><progress aria-label={`${name} population`} max={1} value={value} /></div>)}
      <small>Total population: {(populations.first + populations.second).toFixed(6)} · t = {((frame?.time ?? 0) * 1e15).toFixed(4)} fs</small>
    </div>
    </fieldset>
  </div>
}
