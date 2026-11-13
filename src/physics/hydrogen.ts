import type { Orbital, OrbitalBasis, Settings } from '../types'
import { getPolarAmplitude } from './quantum'
import { integrateGauss } from './integration'
import { equalCoefficients, initialCoefficients, normalizeCoefficients, type DensityMoments, type WaveCoefficients } from './superposition'

// Nonrelativistic Coulomb model with an infinitely massive proton; lengths in a₀.
// https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2007/c2078ff25c61c136e67ceb6fd8eb9b34_lecture21to22.pdf
export const BOHR_RADIUS = 5.29177210544e-11
export const RYDBERG_EV = 13.605693122994
export const LOW_N_LIMIT = 6
export const HIGH_N_LIMIT = 20
export const MAX_N = 50
export const energyEV = (n: number) => -RYDBERG_EV / (n * n)
export const secondOrbital = (s: Pick<Settings, 'n2' | 'l2' | 'm2'>): Orbital => ({ n: s.n2, l: s.l2, m: s.m2 })
export const sameOrbital = (a: Orbital, b: Orbital) => a.n === b.n && a.l === b.l && a.m === b.m
export const pairedState = (s: Pick<Settings, 'superposition' | 'coherentTransition'>) => s.superposition || s.coherentTransition
export function validateOrbital({ n, l, m }: Orbital) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_N || !Number.isInteger(l) || l < 0 || l >= n || !Number.isInteger(m) || Math.abs(m) > l) throw new RangeError(`Use 1 ≤ n ≤ ${MAX_N}, 0 ≤ ℓ < n, and −ℓ ≤ mℓ ≤ ℓ, all integers.`)
}
export function clampOrbital(o: Orbital, maximum: number): Orbital {
  const n = Math.max(1, Math.min(maximum, Math.round(o.n)))
  const l = Math.max(0, Math.min(n - 1, Math.round(o.l)))
  return { n, l, m: l === 0 ? 0 : Math.max(-l, Math.min(l, Math.round(o.m))) }
}
export function realOrbitalLabel(l: number, m: number) {
  if (l === 0) return 's'
  if (l === 1) return ['p_y', 'p_z', 'p_x'][m + 1]
  if (l === 2) return ['d_xy', 'd_yz', 'd_z²', 'd_xz', 'd_x²−y²'][m + 2]
  if (l === 3) return ['f_y(3x²−y²)', 'f_xyz', 'f_yz²', 'f_z³', 'f_xz²', 'f_z(x²−y²)', 'f_x(x²−3y²)'][m + 3]
  // Cartesian shorthand and signed order follow sisl's AtomicOrbital convention.
  if (l === 4) return ['g_xy(x²−y²)', 'g_yz(3x²−y²)', 'g_xyz²', 'g_yz³', 'g_z⁴', 'g_xz³', 'g_z²(x²−y²)', 'g_xz(x²−3y²)', 'g_x⁴+y⁴'][m + 4]
  const shell = ['s', 'p', 'd', 'f', 'g', 'h', 'i', 'k'][l] ?? `ℓ=${l}`
  return m === 0 ? `${shell} · axial` : `${shell} · ${m > 0 ? 'cos' : 'sin'}(${Math.abs(m)}φ)`
}
export function realOrbitalCombination({ n, l, m }: Orbital) {
  const eigenfunction = (order: number) => `\\psi_{${n},${l},${order}}`
  const left = '\\psi_{\\mathrm{real}} = '
  if (m === 0) return left + eigenfunction(0)
  const k = Math.abs(m), phase = k % 2 ? '-' : ''
  return left + `\\frac{${phase}${eigenfunction(k)} ${m > 0 ? '+' : '-'} ${eigenfunction(-k)}}{${m > 0 ? '' : 'i'}\\sqrt{2}}`
}
export const orbitalLabel = (o: Orbital, basis: OrbitalBasis = 'complex') => basis === 'real' ? `${o.n}${realOrbitalLabel(o.l, o.m)}` : `${o.n}${['s', 'p', 'd', 'f', 'g', 'h', 'i', 'k'][o.l] ?? `(ℓ=${o.l})`}, mℓ=${o.m}`
export function adjacentOrbital(o: Orbital, direction: -1 | 1, maximum: number): Orbital {
  if (direction > 0) return o.m < o.l ? { ...o, m: o.m + 1 } : o.l < o.n - 1 ? { n: o.n, l: o.l + 1, m: -o.l - 1 } : o.n < maximum ? { n: o.n + 1, l: 0, m: 0 } : { n: 1, l: 0, m: 0 }
  return o.m > -o.l ? { ...o, m: o.m - 1 } : o.l > 0 ? { n: o.n, l: o.l - 1, m: o.l - 1 } : o.n > 1 ? { n: o.n - 1, l: o.n - 2, m: o.n - 2 } : { n: maximum, l: maximum - 1, m: maximum - 1 }
}
export function laguerre(k: number, alpha: number, x: number) {
  if (k === 0) return 1
  let previous = 1, current = 1 + alpha - x
  for (let i = 2; i <= k; i++) { const next = ((2 * i - 1 + alpha - x) * current - (i - 1 + alpha) * previous) / i; previous = current; current = next }
  return current
}
const logFactorial = (n: number) => { let result = 0; for (let i = 2; i <= n; i++) result += Math.log(i); return result }
export function radialFunction(n: number, l: number) {
  validateOrbital({ n, l, m: 0 })
  const logNormalization = 1.5 * Math.log(2 / n) + 0.5 * (logFactorial(n - l - 1) - Math.log(2 * n) - logFactorial(n + l))
  return (r: number) => {
    if (r < 0 || !Number.isFinite(r)) return 0
    const rho = 2 * r / n
    if (rho === 0) return l === 0 ? Math.exp(logNormalization) * laguerre(n - 1, 1, 0) : 0
    return Math.exp(logNormalization + l * Math.log(rho) - rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho)
  }
}
export function createOrbital(o: Orbital, basis: OrbitalBasis = 'complex') {
  validateOrbital(o)
  const radial = radialFunction(o.n, o.l), polar = getPolarAmplitude(o.l, o.m)
  // Real cosine/sine harmonics combine ±m with the Condon–Shortley phase removed.
  const sign = basis === 'real' || o.m < 0 ? (-1) ** Math.abs(o.m) : 1
  const azimuth = (phi: number) => basis === 'real'
    ? { re: o.m === 0 ? 1 : Math.SQRT2 * (o.m > 0 ? Math.cos(o.m * phi) : Math.sin(-o.m * phi)), im: 0 }
    : { re: Math.cos(o.m * phi), im: Math.sin(o.m * phi) }
  const amplitude = (r: number, u: number) => radial(r) * sign * polar(u)
  const evaluate = (r: number, u: number, phi: number) => { const a = amplitude(r, u), f = azimuth(phi); return { re: a * f.re, im: a * f.im } }
  return { radial, polar: (u: number) => sign * polar(u), azimuth, amplitude, evaluate }
}
export function createHydrogenWavefunction(s: Pick<Settings, 'n' | 'l' | 'm' | 'n2' | 'l2' | 'm2' | 'superposition' | 'coherentTransition' | 'orbitalBasis'>) {
  const basis = s.orbitalBasis
  const first = createOrbital(s, basis), second = createOrbital(secondOrbital(s), basis), paired = pairedState(s)
  const duplicate = paired && sameOrbital(s, secondOrbital(s))
  const defaults = s.coherentTransition || !paired ? initialCoefficients : normalizeCoefficients(equalCoefficients, duplicate)
  const evaluate = (r: number, u: number, phi: number, c: WaveCoefficients = defaults) => {
    const a = first.evaluate(r, u, phi), b = paired ? second.evaluate(r, u, phi) : { re: 0, im: 0 }
    const re = c.first.re * a.re - c.first.im * a.im + c.second.re * b.re - c.second.im * b.im
    const im = c.first.re * a.im + c.first.im * a.re + c.second.re * b.im + c.second.im * b.re
    return { re, im, probability: re * re + im * im, magnitude: Math.hypot(re, im), phase: Math.atan2(im, re) }
  }
  return { first, second, paired, duplicate, defaults, evaluate, basis }
}

export interface RadialTable { radius: number; step: number; cdf: Float64Array }
const radialCache = new Map<string, RadialTable>()
export function radialTable(n: number, l: number): RadialTable {
  const key = `${n}:${l}`, cached = radialCache.get(key)
  if (cached) return cached
  const radial = radialFunction(n, l), radius = 2 * n * n + 16 * n + 16, cells = Math.max(4096, n * 512), step = radius / cells
  const cdf = new Float64Array(cells + 1)
  const density = (r: number) => (r * radial(r)) ** 2
  for (let i = 0; i < cells; i++) cdf[i + 1] = cdf[i] + step / 6 * (density(i * step) + 4 * density((i + 0.5) * step) + density((i + 1) * step))
  const norm = cdf[cells]
  for (let i = 1; i <= cells; i++) cdf[i] /= norm
  const table = { radius, step, cdf }
  if (radialCache.size > 64) radialCache.clear()
  radialCache.set(key, table)
  return table
}
export function radialQuantile(table: RadialTable, p: number) {
  let lo = 0, hi = table.cdf.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table.cdf[mid] < p) lo = mid; else hi = mid }
  return table.step * (lo + (p - table.cdf[lo]) / (table.cdf[hi] - table.cdf[lo] || 1))
}
export function displayRadius(s: Settings, probability = 0.999) {
  const first = radialQuantile(radialTable(s.n, s.l), probability)
  return pairedState(s) ? Math.max(first, radialQuantile(radialTable(s.n2, s.l2), probability)) : first
}
const overlapCache = new Map<string, number>()
export function radialOverlap(a: Orbital, b: Orbital, power = 0) {
  if (!power && a.n !== b.n && a.l === b.l) return 0
  const key = `${a.n}:${a.l}:${b.n}:${b.l}:${power}`, cached = overlapCache.get(key)
  if (cached !== undefined) return cached
  const first = radialFunction(a.n, a.l), second = radialFunction(b.n, b.l)
  const limit = Math.max(radialTable(a.n, a.l).radius, radialTable(b.n, b.l).radius)
  const result = integrateGauss(r => first(r) * second(r) * r ** (2 + power), 0, limit, Math.max(160, 8 * Math.max(a.n, b.n)))
  if (overlapCache.size >= 128) overlapCache.clear()
  overlapCache.set(key, result)
  return result
}
export const meanRadius = ({ n, l }: Orbital) => (3 * n * n - l * (l + 1)) / 2

export function zProjection(s: Settings, c: DensityMoments) {
  if (s.orbitalBasis !== 'real') return c.first * s.m + c.second * s.m2
  if (pairedState(s) && s.n === s.n2 && s.l === s.l2 && s.m !== 0 && s.m2 === -s.m) return s.m * c.sine
  return 0
}
