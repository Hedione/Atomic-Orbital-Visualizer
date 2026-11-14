import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { blochState } from './bloch'
import { marginalAtMoments, prepareDistribution } from './distributions'
import { QuantumTimeline } from './evolution'
import { createHydrogenWavefunction, meanRadius, radialOverlap, secondOrbital } from './hydrogen'
import { MAX_HISTOGRAM_BINS } from './histograms'
import { ElectronEnsemble } from './sampling'
import { combineAmplitudes, densityMoments, mixCoefficients } from './superposition'

it('combines complex basis amplitudes with both coefficient phases', () => {
  const combined = combineAmplitudes({ re: 2, im: -3 }, { re: -4, im: 5 }, { first: { re: 0.3, im: 0.4 }, second: { re: -0.5, im: 0.6 } })
  expect(combined.re).toBeCloseTo(0.8, 12)
  expect(combined.im).toBeCloseTo(-5, 12)
})
import { defaultRabiFrequency } from './transition'

describe('adjustable coherent superpositions', () => {
  const s = { ...defaultSettings, n: 1, l: 0, m: 0, n2: 2, l2: 0, m2: 0, superposition: true, timeEvolution: false }

  it.each(['real', 'complex'] as const)('normalizes unequal %s amplitudes, pure endpoints, duplicate states, and all marginals', orbitalBasis => {
    const basis = prepareDistribution({ ...s, orbitalBasis }, 70)
    for (const mix of [0, 0.2, 0.5, 0.9, 1]) {
      const settings = { ...s, orbitalBasis, superpositionMix: mix }
      const wave = createHydrogenWavefunction(settings), c = densityMoments(wave.defaults)
      expect(c.first).toBeCloseTo(1 - mix, 12); expect(c.second).toBeCloseTo(mix, 12)
      const a = wave.first.evaluate(1.2, 0.3, 0.7), b = wave.second.evaluate(1.2, 0.3, 0.7)
      expect(wave.evaluate(1.2, 0.3, 0.7).re).toBeCloseTo(Math.sqrt(1 - mix) * a.re + Math.sqrt(mix) * b.re, 12)
      const duplicate = createHydrogenWavefunction({ ...settings, n2: 1 })
      expect(duplicate.evaluate(1.2, 0.3, 0.7).probability).toBeCloseTo(a.re ** 2 + a.im ** 2, 12)
      const bloch = blochState(settings)!
      expect(bloch.z).toBeCloseTo(1 - 2 * mix, 12)
      expect(Math.hypot(bloch.x, bloch.y, bloch.z)).toBeCloseTo(1, 12)
      for (const [axis, width] of [['radial', 70], ['polar', 2], ['theta', Math.PI], ['azimuth', 2 * Math.PI]] as const) {
        const marginal = marginalAtMoments(basis[axis], c)
        expect(marginal.every(value => Number.isFinite(value) && value >= 0)).toBe(true)
        expect(marginal.reduce((sum, value) => sum + value, 0) * width / MAX_HISTOGRAM_BINS).toBeCloseTo(1, 5)
      }
    }
  })

  it('samples unequal coherent radial interference and pure endpoints', () => {
    for (const mix of [0, 0.2, 1]) {
      const ensemble = new ElectronEnsemble({ ...s, superpositionMix: mix, count: 10000 })
      ensemble.sample(10000); ensemble.record()
      const radii = Array.from(ensemble.radii.slice(0, ensemble.count)), mean = radii.reduce((sum, r) => sum + r, 0) / radii.length
      const error = Math.sqrt(radii.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (radii.length * (radii.length - 1)))
      const expected = (1 - mix) * meanRadius(s) + mix * meanRadius(secondOrbital(s)) + 2 * Math.sqrt(mix * (1 - mix)) * radialOverlap(s, secondOrbital(s), 1)
      expect(Math.abs(mean - expected)).toBeLessThan(4 * error)
      expect(ensemble.statistics().moments.second).toBeCloseTo(mix, 12)
    }
  })

  it('changes the mix without restarting the clock or losing relative phase', () => {
    const timeline = new QuantumTimeline(), settings = { ...s, timeEvolution: true, superpositionMix: 0.2 }
    timeline.configure(settings, 0)
    const before = timeline.read(750)
    timeline.configure({ ...settings, superpositionMix: 0.8 }, 750)
    expect(timeline.frame.time).toBe(before.time)
    expect(timeline.frame.relativePhase).toBe(before.relativePhase)
    expect(densityMoments(timeline.frame.coefficients!).second).toBeCloseTo(0.8, 12)
    expect(timeline.read(1000).time).toBeCloseTo(2e-15, 25)
  })

  it.each(['real', 'complex'] as const)('applies %s relative phase to interference, Bloch coordinates, marginals, and samples', orbitalBasis => {
    const basis = prepareDistribution({ ...s, orbitalBasis }, 70)
    for (const phase of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const settings = { ...s, orbitalBasis, superpositionPhase: phase }
      const wave = createHydrogenWavefunction(settings), moments = densityMoments(wave.defaults), bloch = blochState(settings)!
      expect(bloch.x).toBeCloseTo(Math.cos(phase), 12)
      expect(bloch.y).toBeCloseTo(Math.sin(phase), 12)
      const a = wave.first.evaluate(1.2, 0.3, 0.7), b = wave.second.evaluate(1.2, 0.3, 0.7)
      expect(wave.evaluate(1.2, 0.3, 0.7).probability).toBeCloseTo((a.re ** 2 + b.re ** 2) / 2 + a.re * b.re * Math.cos(phase), 12)
      for (const [axis, width] of [['radial', 70], ['polar', 2], ['theta', Math.PI], ['azimuth', 2 * Math.PI]] as const) {
        expect(marginalAtMoments(basis[axis], moments).reduce((sum, value) => sum + value, 0) * width / MAX_HISTOGRAM_BINS).toBeCloseTo(1, 5)
      }
      const duplicate = createHydrogenWavefunction({ ...settings, n2: 1 })
      expect(duplicate.evaluate(1.2, 0.3, 0.7).probability).toBeCloseTo(a.re ** 2, 12)
      const ensemble = new ElectronEnsemble({ ...settings, count: 10000 })
      ensemble.sample(10000)
      const radii = Array.from(ensemble.radii.slice(0, ensemble.count)), mean = radii.reduce((sum, r) => sum + r, 0) / radii.length
      const error = Math.sqrt(radii.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (radii.length * (radii.length - 1)))
      const expected = (meanRadius(s) + meanRadius(secondOrbital(s))) / 2 + Math.cos(phase) * radialOverlap(s, secondOrbital(s), 1)
      expect(Math.abs(mean - expected)).toBeLessThan(4 * error)
    }
  })

  it('edits the phase without restarting evolution and ignores it for driven transitions', () => {
    const timeline = new QuantumTimeline(), settings = { ...s, timeEvolution: true }
    timeline.configure(settings, 0)
    const before = timeline.read(750)
    timeline.configure({ ...settings, superpositionPhase: Math.PI / 2 }, 750)
    expect(timeline.frame.time).toBe(before.time)
    expect(timeline.frame.relativePhase - before.relativePhase).toBeCloseTo(Math.PI / 2, 12)
    const beforeBloch = blochState(settings, before.coefficients)!, afterBloch = blochState(settings, timeline.frame.coefficients)!
    expect(afterBloch.x).toBeCloseTo(-beforeBloch.y, 12); expect(afterBloch.y).toBeCloseTo(beforeBloch.x, 12)
    const transition = { ...s, l2: 1, coherentTransition: true, transitionPlaying: true }
    transition.rabiFrequency = defaultRabiFrequency(transition)
    timeline.configure(transition, 0)
    const expected = timeline.read(500).coefficients
    timeline.configure({ ...transition, superpositionPhase: Math.PI }, 0)
    expect(timeline.read(500).coefficients).toEqual(expected)
    expect(() => mixCoefficients(0.5, false, NaN)).toThrow(RangeError)
  })

  it('keeps single states and driven transitions independent of the static mix', () => {
    const timeline = new QuantumTimeline(), transition = { ...s, l2: 1, coherentTransition: true, transitionPlaying: true }
    transition.rabiFrequency = defaultRabiFrequency(transition)
    timeline.configure(transition, 0)
    const expected = timeline.read(500).coefficients
    for (const mix of [0, 0.2, 1]) {
      timeline.configure({ ...transition, superpositionMix: mix }, 0)
      expect(timeline.read(500).coefficients).toEqual(expected)
      const pure = createHydrogenWavefunction({ ...s, superposition: false, superpositionMix: mix })
      expect(densityMoments(pure.defaults).first).toBe(1)
    }
  })

  it('rejects invalid probability weights', () => {
    for (const mix of [-0.01, 1.01, NaN, Infinity]) expect(() => mixCoefficients(mix)).toThrow(RangeError)
  })
})
