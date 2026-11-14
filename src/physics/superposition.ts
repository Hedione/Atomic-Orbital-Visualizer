export interface Complex { re: number; im: number }
export interface WaveCoefficients { first: Complex; second: Complex }
export interface DensityMoments { first: number; second: number; cosine: number; sine: number }
export const equalCoefficients: WaveCoefficients = { first: { re: Math.SQRT1_2, im: 0 }, second: { re: Math.SQRT1_2, im: 0 } }
export const initialCoefficients: WaveCoefficients = { first: { re: 1, im: 0 }, second: { re: 0, im: 0 } }
export function combineAmplitudes(a: Complex, b: Complex, c: WaveCoefficients): Complex {
  return { re: c.first.re * a.re - c.first.im * a.im + c.second.re * b.re - c.second.im * b.im,
    im: c.first.re * a.im + c.first.im * a.re + c.second.re * b.im + c.second.im * b.re }
}
/** One probability weight sets both amplitudes while preserving total probability. */
export function mixCoefficients(secondPopulation = 0.5, duplicate = false, phase = 0): WaveCoefficients {
  if (!Number.isFinite(secondPopulation) || secondPopulation < 0 || secondPopulation > 1) throw new RangeError('State probability must be between 0 and 1')
  if (!Number.isFinite(phase)) throw new RangeError('Relative phase must be finite')
  // Identical orbitals define one state, so their relative phase is unavailable.
  if (duplicate) phase = 0
  const amplitude = Math.sqrt(secondPopulation)
  const c = { first: { re: Math.sqrt(1 - secondPopulation), im: 0 }, second: { re: amplitude * Math.cos(phase), im: amplitude * Math.sin(phase) } }
  return duplicate ? normalizeCoefficients(c, true) : c
}
export function normalizeCoefficients(c: WaveCoefficients, duplicate = false): WaveCoefficients {
  const norm = duplicate ? Math.hypot(c.first.re + c.second.re, c.first.im + c.second.im) : Math.hypot(c.first.re, c.first.im, c.second.re, c.second.im)
  if (!(norm > 0) || !Number.isFinite(norm)) throw new RangeError('The quantum state must have a finite, nonzero norm')
  return { first: { re: c.first.re / norm, im: c.first.im / norm }, second: { re: c.second.re / norm, im: c.second.im / norm } }
}
export function densityMoments(c: WaveCoefficients): DensityMoments {
  return { first: c.first.re ** 2 + c.first.im ** 2, second: c.second.re ** 2 + c.second.im ** 2,
    cosine: 2 * (c.first.re * c.second.re + c.first.im * c.second.im), sine: 2 * (c.first.re * c.second.im - c.first.im * c.second.re) }
}
