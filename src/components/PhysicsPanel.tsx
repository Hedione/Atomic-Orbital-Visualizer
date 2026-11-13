import { ELECTRON_VOLT, HBAR } from '../physics/quantum'
import { BOHR_RADIUS, energyEV, meanRadius, pairedState, radialOverlap, sameOrbital, secondOrbital, zProjection } from '../physics/hydrogen'
import type { Settings } from '../types'
import { MathText, Scientific } from './UI'
import type { QuantumTimeline } from '../physics/evolution'
import { useQuantumFrame } from './CoherentTransition'
import { densityMoments, equalCoefficients, initialCoefficients } from '../physics/superposition'

function EnergyLadder({ n, secondN }: { n: number; secondN?: number }) {
  const levels = [...new Set([1, 2, 3, 4, 5, 6, n, ...(secondN ? [secondN] : [])])].sort((a, b) => b - a)
  let lastLabel = 13
  const rows = levels.map(level => {
    const y = 26 + -energyEV(level) / -energyEV(1) * 370
    const labelY = Math.max(y, lastLabel + 25); lastLabel = labelY
    return { n: level, energy: energyEV(level), y, labelY }
  })
  return <section className="energy-ladder" aria-label="Hydrogen energy levels">
    <div className="card-eyebrow">HYDROGEN ENERGY LEVELS · eV</div>
    <svg className="hydrogen-ladder" viewBox="0 0 340 425" role="img" aria-label="Hydrogen bound energies approach the zero-energy ionization limit">
      <line className="ionization-limit" x1="10" x2="145" y1="26" y2="26" /><text x="155" y="19">0 eV · ionization</text>
      {rows.map(row => { const current = row.n === n || row.n === secondN
        return <g key={row.n} data-n={row.n} data-energy={row.energy} className={current ? 'selected-level' : ''}>
          <line className="energy-line" x1="10" x2="120" y1={row.y} y2={row.y} />
          <path className="energy-leader" d={`M120 ${row.y} L145 ${row.labelY} H150`} />
          <text x="155" y={row.labelY + 3}>n = {row.n}</text><text x="338" y={row.labelY + 3} textAnchor="end">{row.energy.toFixed(row.n > 6 ? 4 : 3)}</text>
        </g>
      })}
    </svg>
    <p className="control-note">Eₙ = −13.6057 / n² eV. States with the same n are degenerate in this Coulomb model.</p>
  </section>
}
export function PhysicsPanel({ settings: s, timeline }: { settings: Settings; timeline?: QuantumTimeline }) {
  const frame = useQuantumFrame(timeline), paired = pairedState(s), second = secondOrbital(s), duplicate = sameOrbital(s, second)
  const c = paired && !duplicate ? densityMoments(frame?.coefficients ?? (s.coherentTransition ? initialCoefficients : equalCoefficients)) : { first: 1, second: 0, cosine: 0, sine: 0 }
  const energy = c.first * energyEV(s.n) + c.second * energyEV(s.n2)
  const rms = Math.sqrt(c.first * s.l * (s.l + 1) + c.second * s.l2 * (s.l2 + 1))
  const projection = zProjection(s, c)
  const radialCross = paired && !duplicate && s.l === s.l2 && s.m === s.m2 ? radialOverlap(s, second, 1) : 0
  const radius = c.first * meanRadius(s) + c.second * meanRadius(second) + c.cosine * radialCross
  const nodes = (first: number, other: number) => paired && !duplicate ? `${first} / ${other}` : String(first)
  return <aside className="physics-panel" aria-label="Physics information">
    <section className="physics-values"><div className="card-eyebrow">STATE OBSERVABLES</div><div className="observable-grid">
      <div className="observable"><label>{paired ? 'Mean energy' : 'Orbital energy'}</label><strong data-testid="energy-value" data-value={energy * ELECTRON_VOLT}>{energy.toFixed(5)} eV</strong><small><Scientific value={energy * ELECTRON_VOLT} unit="J" /></small><div className="observable-symbol"><MathText>{String.raw`\langle E\rangle`}</MathText></div></div>
      <div className="observable"><label>{paired ? 'RMS orbital angular momentum' : 'Orbital angular momentum'}</label><strong>{rms.toFixed(3)} ℏ</strong><small><Scientific value={rms * HBAR} unit="J s" /></small><div className="observable-symbol"><MathText>{String.raw`\sqrt{\langle L^2\rangle}`}</MathText></div></div>
      <div className="observable"><label>Mean z-projection</label><strong data-testid="z-projection">{projection.toFixed(3)} ℏ</strong><small>{s.orbitalBasis === 'real' ? 'Nonaxial real orbitals combine ±mℓ' : 'Lz = mℓ ℏ for an Lz eigenstate'}</small><div className="observable-symbol"><MathText>{String.raw`\langle L_z\rangle`}</MathText></div></div>
      <div className="observable"><label>Mean electron radius</label><strong data-testid="mean-radius">{radius.toFixed(3)} a₀</strong><small>{(radius * BOHR_RADIUS * 1e12).toFixed(2)} pm</small><div className="observable-symbol">⟨r⟩</div></div>
      <div className="observable"><label>{paired ? 'Basis radial nodes' : 'Radial nodes'}</label><strong>{nodes(s.n - s.l - 1, s.n2 - s.l2 - 1)}</strong><small>n − ℓ − 1</small><div className="observable-symbol">r</div></div>
      <div className="observable"><label>{paired ? 'Basis polar nodes' : 'Polar nodes'}</label><strong>{nodes(s.l - Math.abs(s.m), s.l2 - Math.abs(s.m2))}</strong><small>{s.orbitalBasis === 'real' ? 'Polar nodes of the real angular basis' : 'ℓ − |mℓ| · complex spherical harmonics'}</small><div className="observable-symbol">θ</div></div>
    </div></section>
    <EnergyLadder n={s.n} secondN={paired ? s.n2 : undefined} />
  </aside>
}
