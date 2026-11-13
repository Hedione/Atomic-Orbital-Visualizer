import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { integrateGauss } from './integration'
import { getPolarAmplitude } from './quantum'
import { clampOrbital, createHydrogenWavefunction, energyEV, meanRadius, radialFunction, radialOverlap, radialQuantile, radialTable, validateOrbital } from './hydrogen'
import { ElectronEnsemble } from './sampling'
import { densityMoments, equalCoefficients, initialCoefficients } from './superposition'
import { marginalAtMoments, prepareDistribution } from './distributions'
import { defaultRabiFrequency, rabiCoefficients, transitionDipole, transitionRates, transitionTimeScale, validateTransition } from './transition'
import { QuantumTimeline, QUANTUM_TIME_SCALE } from './evolution'
import { MAX_HISTOGRAM_BINS, rebinCounts } from './histograms'

describe('normalized hydrogen orbitals', () => {
  it('matches analytic 1s, 2s, and 2p radial functions', () => {
    for (const r of [0, 0.5, 2, 7]) {
      expect(radialFunction(1, 0)(r)).toBeCloseTo(2 * Math.exp(-r), 12)
      expect(radialFunction(2, 0)(r)).toBeCloseTo((2 - r) * Math.exp(-r / 2) / Math.sqrt(8), 12)
      expect(radialFunction(2, 1)(r)).toBeCloseTo(r * Math.exp(-r / 2) / Math.sqrt(24), 12)
    }
    expect(radialFunction(2, 0)(2)).toBe(0)
  })
  for (const n of [1, 2, 6, 20]) for (const l of [...new Set([0, Math.floor((n - 1) / 2), n - 1])]) {
    it(`normalizes radial and angular factors for n=${n}, ℓ=${l}`, () => {
      const radial = radialFunction(n, l), angular = getPolarAmplitude(l, l)
      expect(integrateGauss(r => (r * radial(r)) ** 2, 0, radialTable(n, l).radius, 320)).toBeCloseTo(1, 7)
      expect(2 * Math.PI * integrateGauss(u => angular(u) ** 2, -1, 1, 96)).toBeCloseTo(1, 10)
      expect(radialQuantile(radialTable(n, l), 0.999)).toBeGreaterThan(0)
    })
  }
  it('enforces n, ℓ, and mℓ bounds together', () => {
    for (const orbital of [{ n: 0, l: 0, m: 0 }, { n: 2, l: 2, m: 0 }, { n: 2, l: 1, m: 2 }, { n: 2.1, l: 0, m: 0 }]) expect(() => validateOrbital(orbital)).toThrow(RangeError)
    expect(clampOrbital({ n: 1, l: 5, m: -5 }, 6)).toEqual({ n: 1, l: 0, m: 0 })
    expect(energyEV(2)).toBeCloseTo(energyEV(1) / 4, 12)
  })
  it('retains radial nodes and normalizes duplicate superpositions', () => {
    const s = { ...defaultSettings, n: 2, l: 0, m: 0, n2: 2, l2: 0, m2: 0, superposition: true }
    const wave = createHydrogenWavefunction(s)
    expect(wave.evaluate(2, 0, 0).probability).toBe(0)
    expect(wave.evaluate(0.5, 0.4, 0.8).probability).toBeCloseTo(radialFunction(2, 0)(0.5) ** 2 / (4 * Math.PI), 12)
  })
  it('same-energy angular superpositions still interfere', () => {
    const s = { ...defaultSettings, orbitalBasis: 'complex' as const, n: 2, l: 1, m: 1, n2: 2, l2: 1, m2: -1, superposition: true }
    const wave = createHydrogenWavefunction(s)
    expect(wave.evaluate(4, 0, 0).probability).toBeCloseTo(0, 12)
    expect(wave.evaluate(4, 0, Math.PI / 2).probability).toBeGreaterThan(0.001)
  })
})

describe('full spatial electron sampling and marginals', () => {
  it('samples the analytic 1s mean radius and isotropic angles', () => {
    const s = { ...defaultSettings, n: 1, l: 0, m: 0, count: 10000 }
    const ensemble = new ElectronEnsemble(s); ensemble.sample(s.count); ensemble.record()
    const mean = Array.from(ensemble.radii.slice(0, s.count)).reduce((a, b) => a + b) / s.count
    const cosine = Array.from(ensemble.cosines.slice(0, s.count)).reduce((a, b) => a + b) / s.count
    expect(mean).toBeCloseTo(1.5, 1); expect(Math.abs(cosine)).toBeLessThan(0.02)
    expect(ensemble.statistics().histogram.reduce((a, b) => a + b)).toBe(s.count)
    expect(rebinCounts(ensemble.statistics().currentHistogram, 40).reduce((a, b) => a + b)).toBe(s.count)
  })
  it('samples the radial interference of distinct s orbitals', () => {
    const s = { ...defaultSettings, n: 1, l: 0, m: 0, n2: 2, l2: 0, m2: 0, superposition: true, count: 10000 }
    const overlap = radialOverlap(s, { n: 2, l: 0, m: 0 }, 1)
    const sampleMean = (sign: number) => {
      const ensemble = new ElectronEnsemble(s)
      ensemble.sample(s.count, { first: equalCoefficients.first, second: { re: sign * Math.SQRT1_2, im: 0 } })
      const values = Array.from(ensemble.radii.slice(0, s.count)), mean = values.reduce((a, b) => a + b) / s.count
      const standardError = Math.sqrt(values.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (s.count * (s.count - 1)))
      return { mean, standardError }
    }
    const base = (meanRadius(s) + meanRadius({ n: 2, l: 0, m: 0 })) / 2
    for (const sign of [1, -1]) {
      const sample = sampleMean(sign)
      expect(Math.abs(sample.mean - base - sign * overlap)).toBeLessThan(3.5 * sample.standardError)
    }
  })
  it('normalizes all three marginals, including complex interference', () => {
    for (const selection of [
      { n: 1, l: 0, m: 0, n2: 2, l2: 0, m2: 0 },
      { n: 2, l: 1, m: 1, n2: 2, l2: 1, m2: -1 },
      { n: 3, l: 0, m: 0, n2: 3, l2: 1, m2: 1 },
    ]) {
      const s = { ...defaultSettings, ...selection, orbitalBasis: 'complex' as const, superposition: true }
      const ensemble = new ElectronEnsemble(s), basis = prepareDistribution(s, ensemble.radius)
      const c = densityMoments({ first: { re: Math.SQRT1_2, im: 0 }, second: { re: 0, im: Math.SQRT1_2 } })
      for (const [axis, width] of [['radial', ensemble.radius], ['polar', 2], ['theta', Math.PI], ['azimuth', 2 * Math.PI]] as const) {
        const theory = marginalAtMoments(basis[axis], c)
        expect(theory.every(x => Number.isFinite(x) && x >= 0)).toBe(true)
        expect(theory.reduce((a, b) => a + b) * width / MAX_HISTOGRAM_BINS).toBeCloseTo(1, 4)
      }
    }
  })
  it('samples the high-n circular orbital without overflow', () => {
    const s = { ...defaultSettings, orbitalBasis: 'complex' as const, n: 20, l: 19, m: 19, count: 1000 }
    const ensemble = new ElectronEnsemble(s); ensemble.sample(s.count)
    expect(Array.from(ensemble.positions.slice(0, s.count * 3)).every(Number.isFinite)).toBe(true)
    expect(Array.from(ensemble.radii.slice(0, s.count)).reduce((a, b) => a + b) / s.count).toBeCloseTo(meanRadius(s), -1)
  })
})

describe('hydrogen electric-dipole transitions and shared time', () => {
  const s = { ...defaultSettings, n: 1, l: 0, m: 0, n2: 2, l2: 1, m2: 0, coherentTransition: true, polarization: 'pi' as const }
  it('uses the analytic radial transition matrix and Lyman-alpha energy gap', () => {
    expect(validateTransition(s).allowed).toBe(true)
    expect(transitionDipole(s)).toBeCloseTo(-256 / (243 * Math.SQRT2), 10)
    expect(transitionRates(s).photonWavelength * 1e9).toBeCloseTo(121.502, 2)
    expect(validateTransition({ ...s, n2: 3 }).allowed).toBe(true)
  })
  it('rejects forbidden ℓ/m changes, mismatched polarization, and zero-gap resonances', () => {
    expect(validateTransition({ ...s, l2: 0 }).allowed).toBe(false)
    expect(validateTransition({ ...s, m2: 1 }).allowed).toBe(false)
    expect(validateTransition({ ...s, m2: 1, polarization: 'sigmaPlus' }).allowed).toBe(true)
    expect(validateTransition({ ...s, m2: -1, polarization: 'sigmaMinus' }).allowed).toBe(true)
    expect(validateTransition({ ...s, n: 2 }).allowed).toBe(false)
    expect(transitionRates({ ...s, n: 2, n2: 1 }).resonance).toBeLessThan(0)
  })
  it('prioritizes the degeneracy explanation over selection rules for same-n states', () => {
    for (const selection of [
      { n: 1, l: 0, m: 0, n2: 1, l2: 0, m2: 0 },
      { n: 2, l: 0, m: 0, n2: 2, l2: 1, m2: 0 },
      { n: 2, l: 1, m: 1, n2: 2, l2: 1, m2: -1 },
    ]) {
      const validation = validateTransition({ ...s, ...selection })
      expect(validation.reason).toBe('These states are degenerate in this model: no finite-frequency resonant photon.')
      expect(validation.allowed).toBe(false); expect(validation.dipole).toBe(0)
    }
    expect(validateTransition({ ...s, l2: 0 }).reason).toBe('Forbidden: Δℓ = 0; electric-dipole transitions require Δℓ = ±1.')
  })
  it('preserves normalization through a π pulse and repeated Rabi cycles', () => {
    for (const t of [0, 0.5, 1, 2, 3, 7]) {
      const c = densityMoments(rabiCoefficients(t * Math.PI, 1, 0.3, true))
      expect(c.first + c.second).toBeCloseTo(1, 12)
    }
    expect(densityMoments(rabiCoefficients(Math.PI, 1, 0)).second).toBe(1)
  })
  it('evolves absolute phase with hydrogen energy while eigenstate density stays fixed', () => {
    const timeline = new QuantumTimeline(), state = { ...defaultSettings, n: 1, l: 0, m: 0 }
    timeline.configure(state, 0)
    const wave = createHydrogenWavefunction(state), before = wave.evaluate(1, 0.5, 0.8, timeline.read(0).coefficients), after = wave.evaluate(1, 0.5, 0.8, timeline.read(1000).coefficients)
    expect(timeline.read(1000).time).toBe(QUANTUM_TIME_SCALE)
    expect(QUANTUM_TIME_SCALE).toBe(1e-15)
    expect(after.probability).toBeCloseTo(before.probability, 12)
    expect(Math.abs(after.im)).toBeGreaterThan(0.01)
    timeline.configure({ ...state, ensemblePaused: true }, 1000)
    expect(timeline.read(2000).time).toBe(timeline.read(1000).time)
  })
  it('advances nominal transition playback by two femtoseconds per display second', () => {
    const timeline = new QuantumTimeline(), state = { ...s, transitionPlaying: true, rabiFrequency: defaultRabiFrequency(s) }
    expect(state.transitionPlayback).toBe(1)
    expect(transitionTimeScale(state)).toBe(2e-15)
    timeline.configure(state, 0)
    expect(timeline.read(1000).time).toBe(2e-15)
  })
  it('scrubs initial, half, and final populations on the shared timeline', () => {
    const timeline = new QuantumTimeline(), state = { ...s, rabiFrequency: defaultRabiFrequency(s) }
    timeline.configure(state, 0)
    expect(timeline.read(0).coefficients).toEqual(initialCoefficients)
    timeline.configure({ ...state, transitionProgress: 0.5, transitionRun: 1 }, 100)
    expect(densityMoments(timeline.frame.coefficients!).second).toBeCloseTo(0.5, 12)
    timeline.configure({ ...state, transitionProgress: 1, transitionRun: 2 }, 200)
    expect(densityMoments(timeline.frame.coefficients!).second).toBe(1)
  })
})
