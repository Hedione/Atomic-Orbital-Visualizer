import { getPolarAmplitude, LOW_J_LIMIT, validateState } from './quantum'
import { combineAmplitudes, densityMoments, initialCoefficients, type DensityMoments } from './superposition'
import { HISTOGRAM_BINS, HISTOGRAM_BIN_OPTIONS, MAX_HISTOGRAM_BINS, rebinCounts } from './histograms'
import type { Settings } from '../types'
import { createHydrogenWavefunction, radialQuantile, radialTable, type RadialTable } from './hydrogen'

export const MAX_ELECTRONS = 10000

export { HISTOGRAM_BINS } from './histograms'
const CDF_RESOLUTION = 8192
const cache = new Map<string, Float64Array>()
const angularTables = new WeakSet<Float64Array>()
const cellSlopes = new WeakMap<Float64Array, { left: Float64Array; right: Float64Array }>()

const cellCDF = (t: number, a: number, b: number) => t * (a + t * (3 - 2 * a - b + t * (a + b - 2)))
const cellPDF = (t: number, a: number, b: number) => a + 2 * t * (3 - 2 * a - b) + 3 * t * t * (a + b - 2)

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function getOrientationCDF(j: number, m: number): Float64Array {
  validateState(j, m)
  const key = `${j}:${Math.abs(m)}`
  const existing = cache.get(key)
  if (existing) return existing
  const angular = j > LOW_J_LIMIT
  const resolution = angular ? 16384 : CDF_RESOLUTION
  const cdf = new Float64Array(resolution + 1)
  const slopes = angular ? { left: new Float64Array(resolution), right: new Float64Array(resolution) } : undefined
  const step = (angular ? Math.PI : 2) / resolution
  const amplitude = getPolarAmplitude(j, m)
  const density = (i: number) => {
    const coordinate = i * step
    const u = angular ? -Math.cos(coordinate) : -1 + coordinate
    const p = amplitude(u)
    return 2 * Math.PI * p * p * (angular ? Math.sin(coordinate) : 1)
  }
  let previous = density(0)
  for (let i = 1; i <= resolution; i++) {
    const current = density(i)
    if (slopes) {
      // Simpson cell masses plus a monotone Hermite CDF resolve narrow high-J nodes.
      const average = (previous + 4 * density(i - 0.5) + current) / 6
      cdf[i] = cdf[i - 1] + average * step
      let a = average > 0 ? previous / average : 1, b = average > 0 ? current / average : 1
      let minimum = Math.min(a, b)
      if (a + b > 2) {
        const vertex = -(3 - 2 * a - b) / (3 * (a + b - 2))
        if (vertex > 0 && vertex < 1) minimum = Math.min(minimum, cellPDF(vertex, a, b))
      }
      if (minimum < 0) {
        const blend = 1 / (1 - minimum + 1e-12)
        a = 1 + blend * (a - 1); b = 1 + blend * (b - 1)
      }
      slopes.left[i - 1] = a; slopes.right[i - 1] = b
    } else cdf[i] = cdf[i - 1] + (previous + current) * step / 2
    previous = current
  }
  const integral = cdf[resolution]
  if (!(integral > 0) || !Number.isFinite(integral)) throw new Error('Invalid orientation probability integral')
  for (let i = 1; i <= resolution; i++) cdf[i] /= integral
  if (angular) angularTables.add(cdf)
  if (slopes) cellSlopes.set(cdf, slopes)
  if (cache.size >= 64) cache.delete(cache.keys().next().value!)
  cache.set(key, cdf)
  return cdf
}

export function inverseCDF(cdf: Float64Array, p: number): number {
  if (p <= 0) return -1
  if (p >= 1) return 1
  let low = 0
  let high = cdf.length - 1
  while (high - low > 1) {
    const mid = (low + high) >>> 1
    if (cdf[mid] <= p) low = mid
    else high = mid
  }
  const interval = cdf[high] - cdf[low]
  const fractionOfMass = interval > 0 ? (p - cdf[low]) / interval : 0
  let t = fractionOfMass
  const slopes = cellSlopes.get(cdf)
  if (slopes && interval > 0) {
    const a = slopes.left[low], b = slopes.right[low]
    let left = 0, right = 1
    for (let iteration = 0; iteration < 16; iteration++) {
      const error = cellCDF(t, a, b) - fractionOfMass
      if (Math.abs(error) < 1e-13) break
      if (error < 0) left = t
      else right = t
      const derivative = cellPDF(t, a, b)
      const next = derivative > 1e-12 ? t - error / derivative : NaN
      t = next > left && next < right ? next : (left + right) / 2
    }
  }
  const fraction = (low + t) / (cdf.length - 1)
  return angularTables.has(cdf) ? -Math.cos(Math.PI * fraction) : -1 + 2 * fraction
}

export function cdfAtU(cdf: Float64Array, u: number): number {
  u = Math.max(-1, Math.min(1, u))
  const fraction = angularTables.has(cdf) ? Math.acos(-u) / Math.PI : (u + 1) / 2
  const index = fraction * (cdf.length - 1)
  const low = Math.floor(index), high = Math.min(cdf.length - 1, low + 1)
  const slopes = cellSlopes.get(cdf)
  const t = index - low
  const fractionOfMass = slopes && low < cdf.length - 1 ? Math.max(0, Math.min(1, cellCDF(t, slopes.left[low], slopes.right[low]))) : t
  return cdf[low] + (cdf[high] - cdf[low]) * fractionOfMass
}

export function polarCapProbability(j: number, m: number, halfAngleDegrees = 10): number {
  if (!(halfAngleDegrees >= 0 && halfAngleDegrees <= 90)) throw new RangeError('Polar cap half angle must be between 0° and 90°')
  const cdf = getOrientationCDF(j, m), limit = Math.cos(halfAngleDegrees * Math.PI / 180)
  return cdfAtU(cdf, -limit) + 1 - cdfAtU(cdf, limit)
}

/** Integrate theory over histogram bins to resolve rapid high-J nodes without aliasing. */
export function polarBinDensities(j: number, m: number, bins = HISTOGRAM_BINS): number[] {
  const cdf = getOrientationCDF(j, m), width = 2 / bins
  return Array.from({ length: bins }, (_, i) => (cdfAtU(cdf, -1 + (i + 1) * width) - cdfAtU(cdf, -1 + i * width)) / width)
}

export function thetaBinDensities(j: number, m: number, bins = HISTOGRAM_BINS): number[] {
  const cdf = getOrientationCDF(j, m), width = Math.PI / bins
  return Array.from({ length: bins }, (_, i) => (cdfAtU(cdf, Math.cos(i * width)) - cdfAtU(cdf, Math.cos((i + 1) * width))) / width)
}

export interface PackedCDF { cdf: Float64Array; angular: boolean; left?: Float64Array; right?: Float64Array }
export function copyOrientationCDF(j: number, m: number): PackedCDF {
  const cdf = getOrientationCDF(j, m), slopes = cellSlopes.get(cdf)
  return { cdf: cdf.slice(), angular: angularTables.has(cdf), left: slopes?.left.slice(), right: slopes?.right.slice() }
}
export function registerOrientationCDF(j: number, m: number, packed: PackedCDF) {
  if (packed.angular) angularTables.add(packed.cdf)
  if (packed.left && packed.right) cellSlopes.set(packed.cdf, { left: packed.left, right: packed.right })
  if (cache.size >= 64) cache.delete(cache.keys().next().value!)
  cache.set(`${j}:${Math.abs(m)}`, packed.cdf)
}

export interface SampleStatistics {
  total: number; histogram: number[]; currentHistogram: number[];
  azimuthHistogram: number[]; currentAzimuthHistogram: number[];
  radialHistogram: number[]; currentRadialHistogram: number[];
  thetaHistogram: number[]; currentThetaHistogram: number[];
  moments: DensityMoments; meanMoments: DensityMoments; radius: number;
}
export const emptyStatistics = (): SampleStatistics => ({
  total: 0, histogram: Array(MAX_HISTOGRAM_BINS).fill(0), currentHistogram: Array(MAX_HISTOGRAM_BINS).fill(0),
  azimuthHistogram: Array(MAX_HISTOGRAM_BINS).fill(0), currentAzimuthHistogram: Array(MAX_HISTOGRAM_BINS).fill(0),
  radialHistogram: Array(MAX_HISTOGRAM_BINS).fill(0), currentRadialHistogram: Array(MAX_HISTOGRAM_BINS).fill(0),
  thetaHistogram: Array(MAX_HISTOGRAM_BINS).fill(0), currentThetaHistogram: Array(MAX_HISTOGRAM_BINS).fill(0),
  moments: densityMoments(initialCoefficients), meanMoments: densityMoments(initialCoefficients), radius: 1,
})

function sampleAzimuth(m: number, real: boolean, random: () => number) {
  for (let attempt = 0; attempt < 10000; attempt++) {
    const phi = 2 * Math.PI * random()
    if (!real || m === 0 || random() <= (m > 0 ? Math.cos(m * phi) : Math.sin(-m * phi)) ** 2) return phi
  }
  throw new Error('Azimuthal sampling did not converge')
}
/** Samples the full |R(r)Y(θ,φ)|² r² dr dΩ; superpositions use a bounded mixture proposal. */
export class ElectronEnsemble {
  readonly positions = new Float32Array(MAX_ELECTRONS * 3)
  readonly radii = new Float64Array(MAX_ELECTRONS)
  readonly cosines = new Float64Array(MAX_ELECTRONS)
  readonly azimuths = new Float64Array(MAX_ELECTRONS)
  readonly radius: number
  count = 0
  total = 0
  private wave: ReturnType<typeof createHydrogenWavefunction>
  private firstRadial: RadialTable
  private secondRadial: RadialTable
  private firstAngular: Float64Array
  private secondAngular: Float64Array
  private orders: [number, number]
  private random: () => number
  private cumulative = Array.from({ length: 4 }, () => new Float64Array(MAX_HISTOGRAM_BINS))
  private current = Array.from({ length: 4 }, () => new Float64Array(MAX_HISTOGRAM_BINS))
  private sums: DensityMoments = { first: 0, second: 0, cosine: 0, sine: 0 }
  private moments = densityMoments(initialCoefficients)
  constructor(s: Settings) {
    this.wave = createHydrogenWavefunction(s)
    this.firstRadial = radialTable(s.n, s.l); this.secondRadial = radialTable(s.n2, s.l2)
    this.firstAngular = getOrientationCDF(s.l, s.m); this.secondAngular = getOrientationCDF(s.l2, s.m2)
    this.orders = [s.m, s.m2]
    this.radius = Math.max(radialQuantile(this.firstRadial, 0.99999), this.wave.paired ? radialQuantile(this.secondRadial, 0.99999) : 0)
    this.random = seededRandom(s.seed)
    this.count = s.count
  }
  sample(count: number, coefficients = this.wave.defaults) {
    this.count = Math.max(1, Math.min(MAX_ELECTRONS, Math.round(count)))
    this.moments = densityMoments(coefficients)
    const { first: p1, second: p2 } = this.moments
    for (let i = 0; i < this.count; i++) {
      let r = 0, u = 0, phi = 0, accepted = false
      for (let attempt = 0; attempt < 10000; attempt++) {
        const second = this.wave.paired && this.random() * (p1 + p2) >= p1
        r = radialQuantile(second ? this.secondRadial : this.firstRadial, this.random())
        u = inverseCDF(second ? this.secondAngular : this.firstAngular, this.random())
        phi = sampleAzimuth(this.orders[second ? 1 : 0], this.wave.basis === 'real', this.random)
        if (!this.wave.paired) { accepted = true; break }
        const a = this.wave.first.evaluate(r, u, phi), b = this.wave.second.evaluate(r, u, phi)
        const proposal = p1 * (a.re * a.re + a.im * a.im) + p2 * (b.re * b.re + b.im * b.im)
        const amplitude = combineAmplitudes(a, b, coefficients)
        if (proposal > 0 && this.random() * 2 * proposal <= amplitude.re * amplitude.re + amplitude.im * amplitude.im) { accepted = true; break }
      }
      if (!accepted) throw new Error('Electron sampling did not converge')
      this.radii[i] = r; this.cosines[i] = u; this.azimuths[i] = phi
      const transverse = r * Math.sqrt(Math.max(0, 1 - u * u))
      this.positions[3 * i] = transverse * Math.cos(phi); this.positions[3 * i + 1] = transverse * Math.sin(phi); this.positions[3 * i + 2] = r * u
    }
  }
  record() {
    this.current.forEach(array => array.fill(0))
    for (let i = 0; i < this.count; i++) {
      const coordinates = [(this.cosines[i] + 1) / 2, this.azimuths[i] / (2 * Math.PI), this.radii[i] / this.radius, Math.acos(this.cosines[i]) / Math.PI]
      for (let axis = 0; axis < 4; axis++) {
        const bin = Math.floor(coordinates[axis] * MAX_HISTOGRAM_BINS)
        if (bin >= 0 && bin < MAX_HISTOGRAM_BINS) { this.current[axis][bin]++; this.cumulative[axis][bin]++ }
      }
    }
    this.total += this.count
    for (const key of ['first', 'second', 'cosine', 'sine'] as const) this.sums[key] += this.count * this.moments[key]
  }
  resetStatistics() { this.total = 0; this.cumulative.forEach(array => array.fill(0)); this.sums = { first: 0, second: 0, cosine: 0, sine: 0 } }
  statistics(): SampleStatistics {
    const meanMoments = this.total ? Object.fromEntries(Object.entries(this.sums).map(([key, value]) => [key, value / this.total])) as unknown as DensityMoments : this.moments
    return { total: this.total, histogram: Array.from(this.cumulative[0]), currentHistogram: Array.from(this.current[0]),
      azimuthHistogram: Array.from(this.cumulative[1]), currentAzimuthHistogram: Array.from(this.current[1]),
      radialHistogram: Array.from(this.cumulative[2]), currentRadialHistogram: Array.from(this.current[2]),
      thetaHistogram: Array.from(this.cumulative[3]), currentThetaHistogram: Array.from(this.current[3]),
      moments: { ...this.moments }, meanMoments, radius: this.radius }
  }
}
