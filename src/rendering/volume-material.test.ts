import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { defaultSettings } from '../types'
import { createHydrogenWavefunction, displayRadius } from '../physics/hydrogen'
import { createVolumeMaterial, createVolumeResources, updateVolumeMaterial, VOLUME_RENDERING } from './volume-material'

describe('float32 orbital lookup tables', () => {
  it('retains nominal brightness calibration for all four volume quantities', () => {
    const radius = displayRadius(defaultSettings), resources = createVolumeResources(defaultSettings, radius)
    const material = createVolumeMaterial(resources, radius, defaultSettings)
    try {
      for (const surfaceQuantity of ['magnitude', 'probability', 'real', 'imaginary'] as const) {
        updateVolumeMaterial(material, resources, { ...defaultSettings, surfaceQuantity }, radius)
        expect(material.uniforms.brightness.value).toBe(0.2)
      }
    } finally { material.dispose(); resources.radial.dispose(); resources.polar.dispose() }
  })
  it('uses one full-precision channel for an unpaired eigenstate', () => {
    const radius = displayRadius(defaultSettings), wave = createHydrogenWavefunction(defaultSettings)
    const resources = createVolumeResources(defaultSettings, radius)
    try {
      expect(resources.radial.image.data.byteLength + resources.polar.image.data.byteLength).toBe(32768)
      expect(resources.radial.format).toBe(THREE.RedFormat)
      for (const i of [0, 1, 17, 2048, 4095]) {
        expect(resources.radial.image.data[i]).toBe(Math.fround(wave.first.radial(radius * i / 4095)))
        expect(resources.polar.image.data[i]).toBe(Math.fround(wave.first.polar(-1 + 2 * i / 4095)))
      }
    } finally { resources.radial.dispose(); resources.polar.dispose() }
  })
  it('packs both coherent basis amplitudes into RG without quantization or reduced resolution', () => {
    const s = { ...defaultSettings, orbitalBasis: 'real' as const, m: -1, superposition: true }
    const radius = displayRadius(s), wave = createHydrogenWavefunction(s), resources = createVolumeResources(s, radius)
    try {
      expect(resources.radial.image.data.byteLength + resources.polar.image.data.byteLength).toBe(65536)
      for (const texture of [resources.radial, resources.polar]) {
        expect(texture.format).toBe(THREE.RGFormat); expect(texture.type).toBe(THREE.FloatType)
        expect(texture.image.width).toBe(4096)
      }
      for (const i of [0, 1, 17, 2048, 4095]) {
        const r = radius * i / 4095, u = -1 + 2 * i / 4095
        expect(resources.radial.image.data[2 * i]).toBe(Math.fround(wave.first.radial(r)))
        expect(resources.radial.image.data[2 * i + 1]).toBe(Math.fround(wave.second.radial(r)))
        expect(resources.polar.image.data[2 * i]).toBe(Math.fround(wave.first.polar(u)))
        expect(resources.polar.image.data[2 * i + 1]).toBe(Math.fround(wave.second.polar(u)))
      }
      const reference = createVolumeMaterial(resources, radius, s, 'reference')
      expect(reference.defines.REFERENCE_GRID).toBe(1)
      expect(reference.uniforms.terminationAlpha.value).toBe(VOLUME_RENDERING.terminationAlpha)
      expect(VOLUME_RENDERING.terminationAlpha).toBeGreaterThanOrEqual(0.985)
      expect(VOLUME_RENDERING.terminationAlpha).toBeLessThan(1)
      reference.dispose()
    } finally { resources.radial.dispose(); resources.polar.dispose() }
  })
})
