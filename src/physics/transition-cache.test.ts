import { expect, it } from 'vitest'
import { defaultSettings } from '../types'
import { transitionDipole } from './transition'

it('keeps cached transition values separate across orbitals, polarization, and basis', () => {
  const s = { ...defaultSettings, orbitalBasis: 'complex' as const, n: 1, l: 0, m: 0, n2: 2, l2: 1, m2: 0 }
  const expected = -256 / (243 * Math.SQRT2)
  for (let pass = 0; pass < 2; pass++) {
    expect(transitionDipole(s)).toBeCloseTo(expected, 10)
    expect(transitionDipole({ ...s, m2: 1 })).toBe(0)
    expect(transitionDipole({ ...s, m2: 1, polarization: 'sigmaPlus' })).toBeCloseTo(expected, 10)
    expect(transitionDipole({ ...s, n2: 3 })).not.toBeCloseTo(expected, 6)
    expect(transitionDipole({ ...s, orbitalBasis: 'real', m2: 1, polarization: 'linearX' })).toBeCloseTo(expected, 10)
    expect(() => transitionDipole({ ...s, n: 0 })).toThrow(RangeError)
  }
})
