import { describe, expect, it } from 'vitest'
import { defaultSettings, type Settings } from '../types'
import { createHydrogenWavefunction, createOrbital, radialOverlap, secondOrbital, zProjection } from './hydrogen'
import { integrateGauss } from './integration'
import { dipoleExpectation, drivingFieldAmplitude, electricField, electromagneticWave, polarizationForTransition, realTransitionDipole, transitionDipole, validateTransition } from './transition'
import { densityMoments, equalCoefficients } from './superposition'
import { ElectronEnsemble } from './sampling'
import { HBAR, ELECTRON_VOLT } from './quantum'
import { BOHR_RADIUS } from './hydrogen'

const state: Settings = { ...defaultSettings, n: 1, l: 0, m: 0, n2: 2, l2: 1, m2: 0, coherentTransition: true }
const axes = ['x', 'y', 'z'] as const

describe('real orbital transitions', () => {
  it.each([[1, 'linearX', 'x'], [-1, 'linearY', 'y'], [0, 'pi', 'z']] as const)('couples 1s to real 2p index %s with the analytic dipole', (m2, polarization, axis) => {
    const s = { ...state, m2, polarization }
    const dipole = -256 / (243 * Math.SQRT2)
    expect(polarizationForTransition(s)).toBe(polarization)
    expect(validateTransition(s).allowed).toBe(true)
    expect(transitionDipole(s)).toBeCloseTo(dipole, 10)
    const vector = realTransitionDipole(s), field = electricField(s, 2, 0, 0)
    for (const key of axes) {
      expect(vector[key]).toBeCloseTo(key === axis ? dipole : 0, 10)
      expect(field[key]).toBe(key === axis ? 1 : 0)
      expect(dipoleExpectation(s, equalCoefficients)[key]).toBeCloseTo(vector[key], 12)
    }
    expect(drivingFieldAmplitude(s) * Math.abs(dipole) * ELECTRON_VOLT * BOHR_RADIUS / HBAR).toBeCloseTo(s.rabiFrequency * 1e12, -1)
    const wave = electromagneticWave(s, 2, 0.3, 0)
    const dot = (a: typeof field, b: typeof field) => axes.reduce((sum, key) => sum + a[key] * b[key], 0)
    expect(dot(wave.electric, wave.direction)).toBe(0)
    expect(dot(wave.magnetic, wave.direction)).toBe(0)
    expect(dot(wave.magnetic, wave.electric)).toBe(0)
    expect(Math.hypot(...Object.values(wave.magnetic))).toBeCloseTo(Math.hypot(...Object.values(wave.electric)), 12)
  })

  it.each([
    [1, 1, 2, -2], [1, -1, 2, 2], [1, 1, 2, -1], [2, -2, 1, 1],
    [2, 0, 3, 1], [3, -2, 4, 3], [4, 4, 5, -5], [5, -5, 4, 4],
  ])('matches independent Cartesian angular integrals for (%s,%s) → (%s,%s)', (l, m, l2, m2) => {
    const s = { ...state, n: l + 1, l, m, n2: l2 + 1, l2, m2 }
    const first = createOrbital(s, 'real'), second = createOrbital(secondOrbital(s), 'real')
    const radial = radialOverlap(s, secondOrbital(s), 1), dipole = realTransitionDipole(s)
    for (const axis of axes) {
      const angular = integrateGauss(u => {
        let sum = 0
        for (let i = 0; i < 64; i++) {
          const phi = i * 2 * Math.PI / 64
          const coordinate = axis === 'z' ? u : Math.sqrt(1 - u * u) * (axis === 'x' ? Math.cos(phi) : Math.sin(phi))
          sum += first.polar(u) * first.azimuth(phi).re * second.polar(u) * second.azimuth(phi).re * coordinate
        }
        return sum * 2 * Math.PI / 64
      }, -1, 1, 96)
      expect(dipole[axis]).toBeCloseTo(-radial * angular, 9)
    }
  })

  it('uses Cartesian coupling rather than differences between real-orbital indices', () => {
    const s = { ...state, n: 2, l: 1, m: 1, n2: 3, l2: 2, m2: -2, polarization: 'linearY' as const }
    expect(Math.abs(s.m2 - s.m)).toBe(3)
    expect(validateTransition(s).allowed).toBe(true)
    expect(validateTransition({ ...s, polarization: 'linearX' }).allowed).toBe(false)
    expect(polarizationForTransition({ ...s, m2: -1 })).toBeUndefined()
    expect(validateTransition({ ...s, n2: s.n, l2: 0, m2: 0 }).reason).toContain('degenerate')
  })

  it('offers exactly one Cartesian drive axis for each coupled real pair through n=6', () => {
    for (let l = 0; l < 5; l++) for (let m = -l; m <= l; m++) for (let m2 = -l - 1; m2 <= l + 1; m2++) {
      const s = { ...state, n: l + 1, l, m, n2: l + 2, l2: l + 1, m2 }
      const count = Object.values(realTransitionDipole(s)).filter(value => Math.abs(value) > 1e-12).length
      expect(count).toBeLessThanOrEqual(1)
      expect(Boolean(polarizationForTransition(s))).toBe(count === 1)
    }
  })

  it('renders and samples the final real p_x orbital with zero mean Lz', () => {
    const s = { ...state, m2: 1, polarization: 'linearX' as const, count: 10000 }
    const coefficients = { first: { re: 0, im: 0 }, second: { re: 1, im: 0 } }
    const wave = createHydrogenWavefunction(s)
    expect(wave.basis).toBe('real')
    expect(wave.evaluate(3, 0, Math.PI / 2, coefficients).probability).toBeCloseTo(0, 12)
    expect(wave.evaluate(3, 0, 0, coefficients).probability).toBeGreaterThan(0)
    expect(zProjection(s, densityMoments(coefficients))).toBe(0)
    const ensemble = new ElectronEnsemble(s); ensemble.sample(s.count, coefficients)
    const moments = [0, 0, 0]
    for (let i = 0; i < ensemble.count; i++) for (let k = 0; k < 3; k++) moments[k] += (ensemble.positions[3 * i + k] / ensemble.radii[i]) ** 2 / ensemble.count
    moments.forEach((value, k) => expect(value).toBeCloseTo(k === 0 ? 0.6 : 0.2, 1))
  })
})
