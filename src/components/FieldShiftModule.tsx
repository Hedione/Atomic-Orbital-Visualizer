import { useLayoutEffect, useRef, useState } from 'react'
import { defaultFieldShiftSettings, type FieldEffect, type FieldShiftSettings } from '../types'
import { energyEV, LOW_N_LIMIT } from '../physics/hydrogen'
import { ELECTRIC_FIELD_LIMIT, fieldShiftLevels, groupShiftLevels, MAGNETIC_FIELD_LIMIT, PLANCK_EV_S, shiftAlongRamp, type ShiftLevel } from '../physics/field-shifts'
import { MathText, Range, Reveal, Stepper, Toggle } from './UI'

type Props = { settings: FieldShiftSettings; onChange: (settings: FieldShiftSettings) => void }
const effects: { value: FieldEffect; label: string }[] = [{ value: 'zeeman', label: 'Zeeman' }, { value: 'stark', label: 'Stark' }, { value: 'parallel', label: 'Parallel' }]
const number = (value: number) => value === 0 ? '0' : Math.abs(value) < 0.001 || Math.abs(value) >= 100000 ? value.toExponential(2) : Number(value.toPrecision(4)).toString()
const spinLabel = (ms: number | null) => ms === null ? 'orbital only' : `mₛ = ${ms > 0 ? '+½' : '−½'}`
const levelLabel = (level: ShiftLevel) => `n = ${level.n}, ${level.l === undefined ? `n₁ = ${level.n1}, n₂ = ${level.n2}, k = ${level.k}` : `ℓ = ${level.l}`}, mℓ = ${level.m}, ${spinLabel(level.ms)}`
const levelColor = (level: ShiftLevel) => level.ms === null ? '#ffb547' : level.ms > 0 ? '#35d3e4' : '#d878ff'
const convert = (value: number, unit: FieldShiftSettings['unit']) => unit === 'energy' ? value * 1e6 : value / PLANCK_EV_S / 1e6
const unitLabel = (unit: FieldShiftSettings['unit']) => unit === 'energy' ? 'μeV' : 'MHz'

export function FieldShiftControls({ settings: s, onChange }: Props) {
  const set = <K extends keyof FieldShiftSettings,>(key: K, value: FieldShiftSettings[K]) => onChange({ ...s, [key]: value })
  const setN = (n: number) => onChange({ ...s, n, l: Math.min(s.l, n - 1) })
  return <div className="field-shift-controls" aria-label="Field shift controls">
    <div className="shift-effect-picker" role="group" aria-label="Field effect">{effects.map(effect => <button type="button" key={effect.value} aria-pressed={s.effect === effect.value} onClick={() => set('effect', effect.value)}>{effect.label}</button>)}</div>
    <p className="control-note">Uniform fields along z. Parallel applies both fields.</p>
    <div className="shift-quantum-editors">
      <Stepper label="Shell n" ariaLabel="Field shell n" value={s.n} min={1} max={LOW_N_LIMIT} onChange={setN} />
      <Stepper label="Orbital ℓ" ariaLabel="Field orbital ℓ" value={s.l} min={0} max={s.n - 1} disabled={s.effect !== 'zeeman' || s.n === 1} onChange={value => set('l', value)} />
    </div>
    <p className="shift-basis-hint">{s.effect === 'zeeman' ? 'One ℓ multiplet · all orbital projections.' : 'Entire n shell · electric fields mix different ℓ.'}</p>
    <Range label="Magnetic field" value={s.magneticField} resetValue={1} min={-MAGNETIC_FIELD_LIMIT} max={MAGNETIC_FIELD_LIMIT} step={0.01} logarithmic={false} suffix="T" input disabled={s.effect === 'stark'} onChange={value => set('magneticField', value)} />
    <Range label="Electric field" value={s.electricField / 1000} resetValue={10} min={-ELECTRIC_FIELD_LIMIT / 1000} max={ELECTRIC_FIELD_LIMIT / 1000} step={0.1} logarithmic={false} suffix="kV/m" input disabled={s.effect === 'zeeman'} onChange={value => set('electricField', value * 1000)} />
    <Toggle label="Electron spin" checked={s.spin} onChange={value => set('spin', value)} hint={s.spin ? 's = ½ · magnetic spin factor gₛ = 2.' : 'Orbital-only comparison; electron spin omitted.'} />
    <Reveal show={s.spin}><div className="shift-spin-picker" role="group" aria-label="Spin projection">
      {([{ value: 'both', label: 'Both', name: 'Show both spins' }, { value: 'down', label: '−½', name: 'Select spin −½' }, { value: 'up', label: '+½', name: 'Select spin +½' }] as const).map(option => <button type="button" key={option.value} aria-label={option.name} aria-pressed={s.spinProjection === option.value} onClick={() => set('spinProjection', option.value)}>{option.label}</button>)}
    </div></Reveal>
    <p className="control-note">{s.effect === 'stark' ? 'Electric shifts leave the spin pair degenerate.' : 'Uncoupled mℓ, mₛ model. Spin–orbit coupling and weak-field Landé splitting are omitted.'}</p>
    <div className="shift-unit-picker" role="group" aria-label="Shift units">
      <button type="button" aria-label="Energy units" aria-pressed={s.unit === 'energy'} onClick={() => set('unit', 'energy')}>μeV</button>
      <button type="button" aria-label="Frequency units" aria-pressed={s.unit === 'frequency'} onClick={() => set('unit', 'frequency')}>MHz</button>
    </div>
    <div className="shift-actions"><button type="button" onClick={() => onChange({ ...s, magneticField: 0, electricField: 0 })}>Zero fields</button><button type="button" onClick={() => onChange({ ...defaultFieldShiftSettings })}>Reset module</button></div>
    <p className="field-caption">EXAMPLES</p>
    <div className="shift-presets">
      <button type="button" onClick={() => onChange({ ...defaultFieldShiftSettings, unit: s.unit })}>Zeeman 2p</button>
      <button type="button" onClick={() => onChange({ ...defaultFieldShiftSettings, effect: 'stark', magneticField: 0, unit: s.unit })}>Stark n = 2</button>
      <button type="button" onClick={() => onChange({ ...defaultFieldShiftSettings, effect: 'parallel', n: 3, magneticField: 0.05, unit: s.unit })}>Parallel n = 3</button>
    </div>
  </div>
}

function SplittingFan({ levels, selected, unit, onSelect }: { levels: ShiftLevel[]; selected: ShiftLevel; unit: FieldShiftSettings['unit']; onSelect: (id: string) => void }) {
  const chart = useRef<SVGSVGElement>(null), [size, setSize] = useState({ width: 700, height: 380 })
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    })
    if (chart.current) observer.observe(chart.current)
    return () => observer.disconnect()
  }, [])
  const groups = groupShiftLevels(levels)
  const maximum = Math.max(...levels.flatMap(level => Array.from({ length: 33 }, (_, i) => Math.abs(shiftAlongRamp(level, i / 32)))))
  const bound = maximum > 0 ? maximum * 1.18 : 1e-6
  const left = 78, right = size.width - 28, top = 30, bottom = size.height - 58
  const x = (fraction: number) => left + fraction * (right - left)
  const y = (energy: number) => top + (1 - energy / bound) / 2 * (bottom - top)
  return <div className="shift-fan-container">
    <div className="shift-chart-title"><h3>Energy-level splitting</h3><span>ΔE / {unitLabel(unit)}</span></div>
    <svg ref={chart} className="shift-fan" viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label="Energy splitting fan">
      <title>Energy corrections as the applied fields ramp from zero to their selected values</title>
      {[-1, -0.5, 0, 0.5, 1].map(tick => <g key={tick}><line className={tick === 0 ? 'shift-zero-line' : 'chart-grid'} x1={left} x2={right} y1={y(bound * tick)} y2={y(bound * tick)} /><text x={left - 9} y={y(bound * tick) + 3} textAnchor="end">{number(convert(bound * tick, unit))}</text></g>)}
      {[0, 0.25, 0.5, 0.75, 1].map(tick => <g key={tick}><line className="chart-grid" x1={x(tick)} x2={x(tick)} y1={top} y2={bottom} /><text x={x(tick)} y={bottom + 20} textAnchor="middle">{tick * 100}%</text></g>)}
      {groups.map(group => {
        const active = group.levels.some(level => level.id === selected.id), representative = active ? selected : group.levels[0]
        const path = Array.from({ length: 33 }, (_, i) => `${i ? 'L' : 'M'}${x(i / 32).toFixed(2)},${y(shiftAlongRamp(representative, i / 32)).toFixed(2)}`).join(' ')
        return <g key={representative.id} style={{ color: levelColor(representative) }} data-degeneracy={group.levels.length}>
          <path className={`shift-branch${active ? ' selected' : ''}`} d={path} role="button" tabIndex={0} aria-label={`Inspect ${levelLabel(representative)}; ${group.levels.length} coincident states`} aria-pressed={active} onClick={() => onSelect(representative.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(representative.id) } }}><title>{levelLabel(representative)} · {number(convert(group.shiftEV, unit))} {unitLabel(unit)} · degeneracy {group.levels.length}</title></path>
          <line className={`shift-level-mark${active ? ' selected' : ''}`} x1={right - 10} x2={right + 8} y1={y(group.shiftEV)} y2={y(group.shiftEV)} />
          {active && <circle className="shift-selected-point" cx={right} cy={y(group.shiftEV)} r={4} />}
        </g>
      })}
      <text x={(left + right) / 2} y={size.height - 7} textAnchor="middle">RAMP FROM ZERO TO SELECTED FIELDS</text>
    </svg>
    <div className="shift-chart-footer"><span>Energy axis fits current fields.</span><span>Coincident states share a line.</span></div>
  </div>
}

export function FieldShiftModule({ settings: s, onChange }: Props) {
  const levels = fieldShiftLevels(s), groups = groupShiftLevels(levels)
  const selected = levels.find(level => level.id === s.selectedState) ?? levels[0]
  const select = (id: string) => onChange({ ...s, selectedState: id })
  const unit = unitLabel(s.unit), value = (energy: number) => `${number(convert(energy, s.unit))} ${unit}`
  const selectedGroup = groups.find(group => group.levels.some(level => level.id === selected.id))!
  const electric = s.effect !== 'zeeman', magnetic = s.effect !== 'stark'
  const magneticFormula = s.spin ? String.raw`\mu_B B(m_\ell+2m_s)` : String.raw`\mu_B Bm_\ell`
  const formula = s.effect === 'zeeman' ? String.raw`\Delta E=` + magneticFormula : s.n === 1 ? String.raw`\Delta E=-\frac94 E_h(F/F_a)^2` + (magnetic && s.spin ? String.raw`+2\mu_B Bm_s` : '') : String.raw`\Delta E=\frac32 nkea_0F` + (magnetic ? '+' + magneticFormula : '')
  return <section className="field-shift-workspace" aria-label="Stark and Zeeman shifts">
    <div className="shift-workspace-heading"><div><span className="eyebrow">EXTERNAL FIELDS · HYDROGEN</span><h2>Stark / Zeeman shifts</h2></div><span className="shift-prototype-badge">PROTOTYPE</span></div>
    <div className="shift-model-note"><strong>Spin–orbit-free perturbative model</strong><span>{electric ? 'Parabolic Stark states; ℓ is mixed.' : 'Spherical states with definite mℓ.'} {s.n === 1 && electric ? 'The 1s electric shift is quadratic.' : 'Excited-shell electric shifts are first order.'} Fine/hyperfine structure and diamagnetic B² terms are omitted.</span></div>
    <div className="shift-summary">
      <div><span>States shown</span><strong data-testid="shift-state-count">{levels.length}</strong></div>
      <div><span>Distinct energies</span><strong data-testid="shift-energy-count">{groups.length}</strong></div>
      <div><span>Coulomb reference Eₙ</span><strong>{energyEV(s.n).toFixed(6)} <small>eV</small></strong></div>
      <div><span>Splitting span</span><strong data-testid="shift-span">{value(groups.at(-1)!.shiftEV - groups[0].shiftEV)}</strong></div>
    </div>
    <div className="shift-applied-fields"><span>Applied: {magnetic ? `B = ${number(s.magneticField)} T` : 'B = 0'} · {electric ? `F = ${number(s.electricField / 1000)} kV/m` : 'F = 0'} · along z</span><span className="shift-spin-legend">{s.spin ? <><i style={{ background: '#d878ff' }} /> mₛ = −½ <i style={{ background: '#35d3e4' }} /> mₛ = +½</> : <><i style={{ background: '#ffb547' }} /> Orbital only</>}</span></div>
    <div className="shift-main-grid">
      <SplittingFan levels={levels} selected={selected} unit={s.unit} onSelect={select} />
      <div className="shift-inspector" aria-label="Selected shifted state">
        <h3>Inspect a state</h3>
        <label htmlFor="shift-state-selection">Quantum numbers</label>
        <select id="shift-state-selection" aria-label="Selected field state" value={selected.id} onChange={event => select(event.target.value)}>{levels.map(level => <option key={level.id} value={level.id}>{levelLabel(level)}</option>)}</select>
        <p className="shift-state-label" data-testid="shift-state-label">{levelLabel(selected)}</p>
        <output className="shift-total" aria-label="Selected energy correction" data-testid="shift-selected" data-shift-ev={selected.shiftEV} data-stark-ev={selected.starkEV} data-zeeman-ev={selected.zeemanEV}>{value(selected.shiftEV)}</output>
        <dl><div><dt>Electric contribution</dt><dd>{value(selected.starkEV)}</dd></div><div><dt>Magnetic contribution</dt><dd>{value(selected.zeemanEV)}</dd></div><div><dt>Frequency equivalent ΔE/h</dt><dd>{number(selected.shiftEV / PLANCK_EV_S / 1e6)} MHz</dd></div><div><dt>States at this energy</dt><dd>{selectedGroup.levels.length}</dd></div></dl>
        <MathText block>{formula}</MathText>
        <p>{s.spin ? 'Spin projection is angular momentum along z, not the direction of the electron’s magnetic moment.' : 'Spin OFF removes its magnetic contribution and duplicated states for comparison.'}</p>
      </div>
    </div>
    <div className="shift-state-table-heading"><h3>Resolved states</h3><span>Choose a row to highlight its branch.</span></div>
    <div className="shift-table-scroll" tabIndex={0} role="region" aria-label="Shifted state energies">
      <table className="shift-state-table"><thead><tr><th scope="col">State</th><th scope="col">Stark / {unit}</th><th scope="col">Zeeman / {unit}</th><th scope="col">Total / {unit}</th></tr></thead><tbody>{[...levels].sort((a, b) => a.shiftEV - b.shiftEV).map(level => <tr key={level.id} className={level.id === selected.id ? 'selected' : undefined} data-shift-ev={level.shiftEV}>
        <td><button type="button" aria-pressed={level.id === selected.id} onClick={() => select(level.id)}><i style={{ background: levelColor(level) }} />{levelLabel(level)}</button></td><td>{number(convert(level.starkEV, s.unit))}</td><td>{number(convert(level.zeemanEV, s.unit))}</td><td>{number(convert(level.shiftEV, s.unit))}</td>
      </tr>)}</tbody></table>
    </div>
    <p className="shift-scope-note">Energy levels, not optical line intensities. Parallel fields use the same z axis. Crossed fields, field-dressed clouds, and inter-shell mixing are outside this prototype. <a href="https://farside.ph.utexas.edu/teaching/qm/lectures/node64.html" target="_blank" rel="noreferrer">Stark reference</a> · <a href="https://www.nist.gov/pml/atomic-spectroscopy-compendium-basic-ideas-notation-data-and-formulas/atomic-spectroscopy-zeeman" target="_blank" rel="noreferrer">Zeeman reference</a>.</p>
  </section>
}
