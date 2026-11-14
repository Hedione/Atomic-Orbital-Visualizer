import type { FieldShiftSettings } from '../types'
import { BOHR_RADIUS, LOW_N_LIMIT } from './hydrogen'

// Equations, basis choices, and literature: STARK_ZEEMAN_PHYSICS.md, sections 3–6.
export const BOHR_MAGNETON_EV_T = 5.7883817982e-5
export const ATOMIC_ELECTRIC_FIELD = 5.14220675112e11
export const HARTREE_EV = 27.211386245981
export const PLANCK_EV_S = 6.62607015e-34 / 1.602176634e-19
export const MAGNETIC_FIELD_LIMIT = 5
export const ELECTRIC_FIELD_LIMIT = 50000

export interface ShiftLevel {
  id: string; n: number; l?: number; m: number; ms: number | null;
  n1?: number; n2?: number; k?: number;
  starkEV: number; zeemanEV: number; shiftEV: number; quadratic: boolean;
}

export function fieldShiftLevels(s: FieldShiftSettings): ShiftLevel[] {
  if (!Number.isInteger(s.n) || s.n < 1 || s.n > LOW_N_LIMIT || !Number.isInteger(s.l) || s.l < 0 || s.l >= s.n) {
    throw new RangeError('Use n = 1–6 and integer ℓ between 0 and n−1.')
  }
  if (!Number.isFinite(s.magneticField) || !Number.isFinite(s.electricField)) throw new RangeError('Fields must be finite.')
  const electric = s.effect !== 'zeeman' ? s.electricField : 0
  const magnetic = s.effect !== 'stark' ? s.magneticField : 0
  const spins: (number | null)[] = !s.spin ? [null] : s.spinProjection === 'both' ? [-0.5, 0.5] : [s.spinProjection === 'up' ? 0.5 : -0.5]
  const levels: ShiftLevel[] = []
  const add = (m: number, ms: number | null, l?: number, n1?: number, n2?: number) => {
    const k = n1 === undefined || n2 === undefined ? undefined : n1 - n2
    const quadratic = s.n === 1 && s.effect !== 'zeeman'
    // shortcut: excited shells retain first-order terms; add inter-shell mixing for quantitative higher-order spectra.
    const starkEV = quadratic ? -2.25 * HARTREE_EV * (electric / ATOMIC_ELECTRIC_FIELD) ** 2 : 1.5 * s.n * (k ?? 0) * BOHR_RADIUS * electric
    const zeemanEV = BOHR_MAGNETON_EV_T * magnetic * (m + 2 * (ms ?? 0))
    levels.push({ id: `${s.effect === 'zeeman' ? `l${l}` : `p${n1},${n2}`}:n${s.n}:m${m}:s${ms}`, n: s.n, l, m, ms, n1, n2, k, starkEV, zeemanEV, shiftEV: starkEV + zeemanEV, quadratic })
  }
  if (s.effect === 'zeeman') {
    for (let m = -s.l; m <= s.l; m++) for (const ms of spins) add(m, ms, s.l)
  } else {
    for (let m = 1 - s.n; m < s.n; m++) {
      const remaining = s.n - Math.abs(m) - 1
      for (let n1 = 0; n1 <= remaining; n1++) for (const ms of spins) add(m, ms, undefined, n1, remaining - n1)
    }
  }
  return levels
}

export const shiftAlongRamp = (level: ShiftLevel, fraction: number) => level.zeemanEV * fraction + level.starkEV * (level.quadratic ? fraction ** 2 : fraction)

export function groupShiftLevels(levels: ShiftLevel[]) {
  const tolerance = Math.max(1e-30, ...levels.map(level => Math.abs(level.shiftEV) * 1e-9))
  const groups: { shiftEV: number; levels: ShiftLevel[] }[] = []
  for (const level of [...levels].sort((a, b) => a.shiftEV - b.shiftEV)) {
    const previous = groups.at(-1)
    if (previous && Math.abs(previous.shiftEV - level.shiftEV) <= tolerance) previous.levels.push(level)
    else groups.push({ shiftEV: level.shiftEV, levels: [level] })
  }
  return groups
}
