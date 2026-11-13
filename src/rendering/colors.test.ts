import { describe, expect, it } from 'vitest'
import type { ElectronPalette } from '../types'
import { getElectronColor, hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from './colors'

describe('electron RGB wheel', () => {
  it('keeps a removed preset safe when hot refresh preserves an old selection', () => {
    expect(getElectronColor({ electronPalette: 'green' as ElectronPalette, customElectronColor: '#123456' })).toBe('#72ddc8')
  })
  it('maps the wheel to the six RGB primaries and secondaries', () => {
    for (const [h, hex] of [[0, '#ff0000'], [60, '#ffff00'], [120, '#00ff00'], [180, '#00ffff'], [240, '#0000ff'], [300, '#ff00ff']] as const) {
      expect(rgbToHex(hsvToRgb({ h, s: 1, v: 1 }))).toBe(hex)
      expect(rgbToHsv(hexToRgb(hex))).toEqual({ h, s: 1, v: 1 })
    }
  })
  it('preserves arbitrary RGB colors, grayscale, and brightness through a wheel round trip', () => {
    for (const hex of ['#72ddc8', '#00f58a', '#aa28ff', '#2f9fff', '#ff9b32', '#123456', '#ffffff', '#000000', '#808080']) {
      expect(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb(hex))))).toBe(hex)
    }
  })
})
