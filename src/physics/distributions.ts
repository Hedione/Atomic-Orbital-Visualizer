import type { Settings } from '../types'
import { createHydrogenWavefunction, radialOverlap, secondOrbital } from './hydrogen'
import { integrateGauss } from './integration'
import { MAX_HISTOGRAM_BINS } from './histograms'
import type { DensityMoments } from './superposition'

export interface DistributionBasis { first: number[]; second: number[]; cosine: number[]; sine: number[] }
export interface DistributionTheory { polar: DistributionBasis; theta: DistributionBasis; radial: DistributionBasis; azimuth: DistributionBasis }
/** All marginals integrate over the other two coordinates, including the radial Jacobian. */
export function prepareDistribution(s: Settings, radius: number): DistributionTheory {
  const wave = createHydrogenWavefunction(s), second = secondOrbital(s)
  const overlap = wave.paired ? radialOverlap(s, second) : 0
  const angularOverlap = wave.paired ? integrateGauss(u => wave.first.polar(u) * wave.second.polar(u), -1, 1, 96) : 0
  const sameAngular = s.l === s.l2 && s.m === s.m2
  const polarFactors = (u: number) => { const a = wave.first.polar(u), b = wave.second.polar(u); return [2 * Math.PI * a * a, wave.paired ? 2 * Math.PI * b * b : 0, wave.paired && s.m === s.m2 ? 2 * Math.PI * overlap * a * b : 0, 0] }
  const bins = MAX_HISTOGRAM_BINS
  const basis = (f: (x: number) => number[], lo: number, hi: number): DistributionBasis => {
    const arrays = Array.from({ length: 4 }, () => Array<number>(bins).fill(0)), width = (hi - lo) / bins
    for (let i = 0; i < bins; i++) for (let k = 0; k < 4; k++) arrays[k][i] = integrateGauss(x => f(x)[k], lo + i * width, lo + (i + 1) * width, 8) / width
    return { first: arrays[0], second: arrays[1], cosine: arrays[2], sine: arrays[3] }
  }
  return {
    radial: basis(r => { const a = wave.first.radial(r), b = wave.second.radial(r); return [r * r * a * a, wave.paired ? r * r * b * b : 0, sameAngular && wave.paired ? r * r * a * b : 0, 0] }, 0, radius),
    polar: basis(polarFactors, -1, 1),
    theta: basis(theta => polarFactors(Math.cos(theta)).map(value => value * Math.sin(theta)), 0, Math.PI),
    azimuth: basis(phi => {
      const a = wave.first.azimuth(phi), b = wave.second.azimuth(phi), cross = wave.paired ? overlap * angularOverlap : 0
      return [(a.re * a.re + a.im * a.im) / (2 * Math.PI), wave.paired ? (b.re * b.re + b.im * b.im) / (2 * Math.PI) : 0,
        cross * (a.re * b.re + a.im * b.im), -cross * (a.re * b.im - a.im * b.re)]
    }, 0, 2 * Math.PI),
  }
}
export function marginalAtMoments(b: DistributionBasis, c: DensityMoments) {
  return b.first.map((a, i) => Math.max(0, a * c.first + b.second[i] * c.second + b.cosine[i] * c.cosine + b.sine[i] * c.sine))
}
