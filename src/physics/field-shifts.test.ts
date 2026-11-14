import { expect, it } from 'vitest'
import { defaultFieldShiftSettings as defaults } from '../types'
import { BOHR_RADIUS } from './hydrogen'
import { ATOMIC_ELECTRIC_FIELD, BOHR_MAGNETON_EV_T, fieldShiftLevels, groupShiftLevels, HARTREE_EV, shiftAlongRamp } from './field-shifts'

it.each([1, 2, 3, 4, 5, 6])('enumerates the full n=%i Stark shell with the parabolic constraints', n => {
  const levels = fieldShiftLevels({ ...defaults, effect: 'stark', n, l: 0 })
  expect(levels).toHaveLength(2 * n * n)
  expect(new Set(levels.map(level => level.id)).size).toBe(levels.length)
  for (const level of levels) {
    expect(level.n1! + level.n2! + Math.abs(level.m) + 1).toBe(n)
    expect(level.k).toBe(level.n1! - level.n2!)
    expect(level.l).toBeUndefined()
  }
})

it('recovers the literature n=2 Stark quartet and preserves its central degeneracy', () => {
  const levels = fieldShiftLevels({ ...defaults, effect: 'stark', spin: false })
  const shifts = levels.map(level => level.shiftEV).sort((a, b) => a - b)
  const expected = 3 * BOHR_RADIUS * defaults.electricField
  expect(shifts).toEqual([-expected, 0, 0, expected])
  expect(groupShiftLevels(levels).map(group => group.levels.length)).toEqual([1, 2, 1])
})

it('gives the 1s quadratic Stark shift, even in field direction and quadratic along the ramp', () => {
  const settings = { ...defaults, effect: 'stark' as const, n: 1, l: 0 }
  const levels = fieldShiftLevels(settings), reversed = fieldShiftLevels({ ...settings, electricField: -settings.electricField })
  const expected = -2.25 * HARTREE_EV * (settings.electricField / ATOMIC_ELECTRIC_FIELD) ** 2
  expect(levels.map(level => level.shiftEV)).toEqual([expected, expected])
  expect(reversed.map(level => level.shiftEV)).toEqual([expected, expected])
  expect(shiftAlongRamp(levels[0], 0.5)).toBe(expected / 4)
})

it('includes spin splitting for an s state and the five distinct uncoupled p energies', () => {
  const s = fieldShiftLevels({ ...defaults, l: 0 })
  expect(s.map(level => level.shiftEV)).toEqual([-BOHR_MAGNETON_EV_T, BOHR_MAGNETON_EV_T])
  const p = fieldShiftLevels(defaults)
  expect(p).toHaveLength(6)
  expect(groupShiftLevels(p).map(group => group.levels.length)).toEqual([1, 1, 2, 1, 1])
  expect(fieldShiftLevels({ ...defaults, spin: false })).toHaveLength(3)
})

it('selects either spin projection without changing its energy', () => {
  for (const projection of ['up', 'down'] as const) {
    const levels = fieldShiftLevels({ ...defaults, effect: 'parallel', spinProjection: projection })
    const all = fieldShiftLevels({ ...defaults, effect: 'parallel' })
    expect(levels).toHaveLength(4)
    for (const level of levels) {
      expect(level.ms).toBe(projection === 'up' ? 0.5 : -0.5)
      expect(level.shiftEV).toBe(all.find(other => other.id === level.id)!.shiftEV)
    }
  }
})

it('adds parallel-field shifts and reverses first-order shifts when both fields reverse', () => {
  const settings = { ...defaults, effect: 'parallel' as const, n: 3 }
  const levels = fieldShiftLevels(settings)
  const reversed = fieldShiftLevels({ ...settings, electricField: -settings.electricField, magneticField: -settings.magneticField })
  for (const [index, level] of levels.entries()) {
    expect(level.shiftEV).toBe(level.starkEV + level.zeemanEV)
    expect(level.zeemanEV).toBe(BOHR_MAGNETON_EV_T * settings.magneticField * (level.m + 2 * level.ms!))
    expect(reversed[index].shiftEV).toBe(-level.shiftEV)
    expect(shiftAlongRamp(level, 0.5)).toBe(level.shiftEV / 2)
  }
})

it('ignores the inactive field and collapses to one energy at zero fields', () => {
  expect(fieldShiftLevels({ ...defaults, electricField: 0 })).toEqual(fieldShiftLevels(defaults))
  for (const effect of ['zeeman', 'stark', 'parallel'] as const) {
    const levels = fieldShiftLevels({ ...defaults, effect, magneticField: 0, electricField: 0 })
    expect(levels.every(level => level.shiftEV === 0)).toBe(true)
    expect(groupShiftLevels(levels)).toHaveLength(1)
  }
})

it('rejects invalid quantum numbers and nonfinite fields', () => {
  for (const patch of [{ n: 0 }, { n: 7 }, { l: 2 }, { l: -1 }, { n: 1.5 }, { magneticField: NaN }, { electricField: Infinity }]) {
    expect(() => fieldShiftLevels({ ...defaults, ...patch })).toThrow(RangeError)
  }
})
