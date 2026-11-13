import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyCameraView, MIN_CAMERA_DISTANCE, orthographicViewZoom, readCameraView, scaleBar } from './camera'

describe('field camera projection', () => {
  it.each([1, -1])('keeps the projected helix radius constant looking along z = %s', sign => {
    const camera = new THREE.OrthographicCamera()
    const size = { width: 600, height: 400 }, baseZoom = orthographicViewZoom(size.height, 1)
    applyCameraView(camera, { position: [0, 0, sign * 10], target: [0, 0, 0] }, 1, baseZoom, size)
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
    const radii = Array.from({ length: 161 }, (_, i) => {
      const z = (i / 160 * 2 - 1) * 2.5, angle = z * 2 * Math.PI / 3
      const point = new THREE.Vector3(2.2 * Math.cos(angle), 2.2 * Math.sin(angle), z).project(camera)
      return Math.hypot(point.x * size.width / 2, point.y * size.height / 2)
    })
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1e-12)
    expect(radii[0]).toBeCloseTo(baseZoom * Math.hypot(4.4, -6.3, 3.7) / 10 * 2.2, 10)
  })
  it('round-trips synchronized views through perspective and orthographic cameras at different sizes', () => {
    for (const fit of [1, 1.2, 3]) for (const distance of [MIN_CAMERA_DISTANCE, 3.2, 8, 16]) {
      const view = { position: [distance, -distance / 2, distance / 3], target: [0.3, -0.2, 0.1] }
      for (const camera of [new THREE.PerspectiveCamera(), new THREE.OrthographicCamera()]) {
        const zoom = orthographicViewZoom(430, fit)
        applyCameraView(camera, view, fit, zoom, { width: 600, height: 430 })
        const restored = readCameraView(camera, new THREE.Vector3().fromArray(view.target), fit, zoom)
        restored.position.forEach((value, index) => expect(value).toBeCloseTo(view.position[index], 12))
        expect(restored.target).toEqual(view.target)
      }
    }
  })
})

describe('physical zoom scale', () => {
  it.each(['perspective', 'orthographic'])('matches projected lengths and updates with %s zoom', projection => {
    const size = { width: 600, height: 400 }, target = new THREE.Vector3(0.2, -0.4, 0.1)
    const camera = projection === 'perspective' ? new THREE.PerspectiveCamera(40) : new THREE.OrthographicCamera()
    const baseZoom = orthographicViewZoom(size.height, 1), metresPerUnit = 1e-9
    let previous = Infinity
    for (const distance of [10, 5, MIN_CAMERA_DISTANCE]) {
      applyCameraView(camera, { position: [target.x, target.y, target.z + distance], target: target.toArray() }, 1, baseZoom, size)
      camera.lookAt(target); camera.updateMatrixWorld()
      const scale = scaleBar(camera, target, size.height, metresPerUnit)!
      const left = target.clone().project(camera)
      const right = target.clone().add(new THREE.Vector3(scale.metres / metresPerUnit, 0, 0)).project(camera)
      expect((right.x - left.x) * size.width / 2).toBeCloseTo(scale.pixels, 10)
      expect(scale.pixels).toBeGreaterThan(0); expect(scale.pixels).toBeLessThanOrEqual(80)
      expect(scale.metres).toBeLessThan(previous)
      expect(scale.label).toMatch(/ (p|n)m$/)
      previous = scale.metres
    }
  })
  it('omits the scale until the viewport has a measurable height', () => {
    const camera = new THREE.PerspectiveCamera(40); camera.position.z = 10
    expect(scaleBar(camera, new THREE.Vector3(), 0, 1e-9)).toBeUndefined()
  })
})
