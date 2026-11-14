import { expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { QuantumTimeline } from './evolution'
import { defaultRabiFrequency } from './transition'

it('reuses unchanged paused frames and creates a new frame when time advances', () => {
  const timeline = new QuantumTimeline()
  timeline.configure({ ...defaultSettings, ensemblePaused: true }, 0)
  const frozen = timeline.read(100)
  expect(timeline.read(200)).toBe(frozen)
  timeline.configure(defaultSettings, 200)
  expect(timeline.read(300)).not.toBe(frozen)
  expect(timeline.read(300)).toBe(timeline.read(300))
  expect(timeline.read(400).time).toBeGreaterThan(timeline.read(300).time)
})

it('invalidates paused frames for mix, phase, and evolution changes at the same time', () => {
  const timeline = new QuantumTimeline(), settings = { ...defaultSettings, superposition: true, ensemblePaused: true }
  timeline.configure(settings, 0)
  const original = timeline.read(10)
  timeline.configure({ ...settings, superpositionMix: 0.25, superpositionPhase: Math.PI / 2 }, 10)
  const changed = timeline.read(20)
  expect(changed).not.toBe(original)
  expect(changed.time).toBe(original.time)
  expect(changed.coefficients!.second.im).toBeCloseTo(0.5, 12)
  expect(timeline.read(30)).toBe(changed)
  timeline.configure({ ...settings, timeEvolution: false }, 30)
  expect(timeline.read(40).enabled).toBe(false)
  expect(timeline.read(40)).not.toBe(changed)
})

it('reuses completed pulse frames and refreshes them when scrubbing or enabling loops', () => {
  const timeline = new QuantumTimeline()
  const settings = { ...defaultSettings, orbitalBasis: 'complex' as const, coherentTransition: true, n: 1, l: 0, m: 0, n2: 2, l2: 1, m2: 0, transitionPlaying: true }
  settings.rabiFrequency = defaultRabiFrequency(settings)
  timeline.configure(settings, 0)
  const final = timeline.read(100000)
  expect(final.progress).toBe(1)
  expect(timeline.read(200000)).toBe(final)
  timeline.configure({ ...settings, transitionPlaying: false, transitionProgress: 0.5, transitionRun: 1 }, 200000)
  expect(timeline.read(300000).progress).toBeCloseTo(0.5, 12)
  expect(timeline.read(300000)).not.toBe(final)
  timeline.configure({ ...settings, transitionLoop: true }, 300000)
  expect(timeline.read(300100)).not.toBe(timeline.read(300200))
})
