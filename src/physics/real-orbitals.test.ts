import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { createHydrogenWavefunction, createOrbital, realOrbitalLabel, zProjection } from './hydrogen'
import { ElectronEnsemble } from './sampling'
import { integrateGauss } from './integration'
import { densityMoments, equalCoefficients } from './superposition'
import { marginalAtMoments, prepareDistribution } from './distributions'
import { MAX_HISTOGRAM_BINS } from './histograms'

describe('real orbital combinations', () => {
  for (const l of [1, 2, 3, 5, 19]) for (const m of [...new Set([-l, 0, l])]) {
    it(`normalizes the real harmonic ℓ=${l}, index=${m}`, () => {
      const orbital = createOrbital({ n: l + 1, l, m }, 'real')
      const polar = integrateGauss(u => orbital.polar(u) ** 2, -1, 1, 96)
      const azimuth = Array.from({ length: 256 }, (_, i) => orbital.azimuth(2 * Math.PI * i / 256).re ** 2).reduce((a, b) => a + b) * 2 * Math.PI / 256
      expect(polar * azimuth).toBeCloseTo(1, 10)
      expect(Math.abs(orbital.evaluate(2, 0.3, 0.7).im)).toBe(0)
    })
  }
  it('names all seven real f orientations in their signed harmonic order', () => {
    expect(Array.from({ length: 7 }, (_, i) => realOrbitalLabel(3, i - 3))).toEqual([
      'f_y(3x²−y²)', 'f_xyz', 'f_yz²', 'f_z³', 'f_xz²', 'f_z(x²−y²)', 'f_x(x²−3y²)',
    ])
  })
  it('uses documented g names while retaining the h harmonic convention', () => {
    expect(Array.from({ length: 9 }, (_, i) => realOrbitalLabel(4, i - 4))).toEqual([
      'g_xy(x²−y²)', 'g_yz(3x²−y²)', 'g_xyz²', 'g_yz³', 'g_z⁴', 'g_xz³', 'g_z²(x²−y²)', 'g_xz(x²−3y²)', 'g_x⁴+y⁴',
    ])
    expect(realOrbitalLabel(5, -1)).toBe('h · sin(1φ)')
    expect(realOrbitalLabel(5, 0)).toBe('h · axial')
    expect(realOrbitalLabel(5, 1)).toBe('h · cos(1φ)')
  })
  it('forms p_x and p_y from the correct ±m combinations', () => {
    const positive = createOrbital({ n: 2, l: 1, m: 1 }), negative = createOrbital({ n: 2, l: 1, m: -1 })
    const px = createOrbital({ n: 2, l: 1, m: 1 }, 'real'), py = createOrbital({ n: 2, l: 1, m: -1 }, 'real')
    for (const phi of [0, 0.4, 1.1, Math.PI / 2]) {
      const a = positive.evaluate(3, 0.2, phi), b = negative.evaluate(3, 0.2, phi)
      expect(px.evaluate(3, 0.2, phi).re).toBeCloseTo((b.re - a.re) / Math.SQRT2, 12)
      expect(py.evaluate(3, 0.2, phi).re).toBeCloseTo(-(a.im + b.im) / Math.SQRT2, 12)
    }
    expect(px.evaluate(3, 0, Math.PI / 2).re).toBeCloseTo(0, 12)
    expect(py.evaluate(3, 0, 0).re).toBe(0)
  })
  it('matches the displayed normalized complex-basis convention through high n', () => {
    for (const l of [1, 2, 5, 19]) for (const m of [...new Set([-l, -1, 0, 1, l])]) {
      const k = Math.abs(m), phase = (-1) ** k, n = l + 1
      const real = createOrbital({ n, l, m }, 'real')
      const positive = createOrbital({ n, l, m: k }), negative = createOrbital({ n, l, m: -k })
      for (const phi of [0.3, 1.1, 2.7]) {
        const a = positive.evaluate(n * n, 0.2, phi), b = negative.evaluate(n * n, 0.2, phi)
        const expected = m === 0 ? a : m > 0
          ? { re: (phase * a.re + b.re) / Math.SQRT2, im: (phase * a.im + b.im) / Math.SQRT2 }
          : { re: (phase * a.im - b.im) / Math.SQRT2, im: -(phase * a.re - b.re) / Math.SQRT2 }
        expect(real.evaluate(n * n, 0.2, phi).re).toBeCloseTo(expected.re, 12)
        expect(expected.im).toBeCloseTo(0, 12)
      }
    }
  })
  for (const [m, axis] of [[1, 0], [-1, 1], [0, 2]] as const) {
    it(`samples a real p orbital along axis ${axis}`, () => {
      const ensemble = new ElectronEnsemble({ ...defaultSettings, m, orbitalBasis: 'real', count: 10000 })
      ensemble.sample(10000)
      const secondMoments = [0, 0, 0]
      for (let i = 0; i < ensemble.count; i++) for (let k = 0; k < 3; k++) secondMoments[k] += (ensemble.positions[3 * i + k] / ensemble.radii[i]) ** 2 / ensemble.count
      secondMoments.forEach((value, k) => expect(Math.abs(value - (k === axis ? 0.6 : 0.2))).toBeLessThan(0.015))
    })
  }
  it('samples coherent real-orbital interference and integrates its marginals', () => {
    const s = { ...defaultSettings, orbitalBasis: 'real' as const, n: 2, l: 1, m: 1, n2: 2, l2: 1, m2: -1, superposition: true, count: 10000 }
    const ensemble = new ElectronEnsemble(s); ensemble.sample(s.count)
    let cross = 0
    for (let i = 0; i < ensemble.count; i++) cross += ensemble.positions[3 * i] * ensemble.positions[3 * i + 1] / ensemble.radii[i] ** 2 / ensemble.count
    expect(Math.abs(cross - 0.2)).toBeLessThan(0.015)
    const basis = prepareDistribution(s, ensemble.radius), moments = densityMoments(equalCoefficients)
    for (const [axis, width] of [['radial', ensemble.radius], ['polar', 2], ['theta', Math.PI], ['azimuth', 2 * Math.PI]] as const) {
      const marginal = marginalAtMoments(basis[axis], moments)
      expect(marginal.reduce((a, b) => a + b) * width / MAX_HISTOGRAM_BINS).toBeCloseTo(1, 4)
    }
    const wave = createHydrogenWavefunction(s)
    expect(wave.evaluate(4, 0, -Math.PI / 4).probability).toBeCloseTo(0, 12)
  })
  it('reports zero Lz for a real p orbital and the correct coherent cross term', () => {
    const s = { ...defaultSettings, orbitalBasis: 'real' as const, m: 1 }
    expect(zProjection(s, { first: 1, second: 0, cosine: 0, sine: 0 })).toBe(0)
    const coherent = { ...s, superposition: true, n2: 2, l2: 1, m2: -1 }
    expect(zProjection(coherent, densityMoments({ first: { re: Math.SQRT1_2, im: 0 }, second: { re: 0, im: Math.SQRT1_2 } }))).toBeCloseTo(1, 12)
  })
})
