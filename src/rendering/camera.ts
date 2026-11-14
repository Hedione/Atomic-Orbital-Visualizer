import * as THREE from 'three'
import { formatSI } from '../formatting'
type Vec3 = [number, number, number]

export const INITIAL_CAMERA: Vec3 = [4.4, -6.3, 3.7]
export const CAMERA_FOV = 40
export const MIN_CAMERA_DISTANCE = 0.8
const referenceDistance = Math.hypot(...INITIAL_CAMERA)
type Camera = THREE.PerspectiveCamera | THREE.OrthographicCamera
export interface CameraView { position: number[]; target: number[] }
export interface CameraLink { view: CameraView; events: EventTarget }
export interface ViewportSize { width: number; height: number }

export const cameraFit = (size: ViewportSize, fitScale = 1, reference = size) => Math.max(1, reference.height / Math.max(1, reference.width) * 0.95) * Math.max(1, fitScale) * Math.max(1, size.height) / Math.max(1, reference.height)

/** Uniform screen-space dots follow orbit zoom, with 4px at the fitted default view. */
export function electronPointSize(density: number, camera: THREE.Camera, target: THREE.Vector3, size: { width: number; height: number }) {
  return 4 * density * referenceDistance * cameraFit(size) / camera.position.distanceTo(target)
}

export const orthographicViewZoom = (height: number, fit: number) => height / (2 * referenceDistance * Math.tan(CAMERA_FOV * Math.PI / 360) * fit)

/** Store an equivalent perspective distance so both projections share orbit, pan, and zoom. */
export function readCameraView(camera: Camera, target: THREE.Vector3, fit: number, baseZoom: number): CameraView {
  const zoom = camera instanceof THREE.OrthographicCamera ? camera.zoom / baseZoom : 1
  return { position: camera.position.clone().sub(target).divideScalar(fit * zoom).add(target).toArray(), target: target.toArray() }
}

export function applyCameraView(camera: Camera, view: CameraView, fit: number, baseZoom: number, size: { width: number; height: number }) {
  const target = new THREE.Vector3().fromArray(view.target)
  const offset = new THREE.Vector3().fromArray(view.position).sub(target)
  if (camera instanceof THREE.OrthographicCamera) {
    camera.left = -size.width / 2; camera.right = size.width / 2
    camera.top = size.height / 2; camera.bottom = -size.height / 2
    camera.zoom = baseZoom * referenceDistance / offset.length()
    offset.setLength(referenceDistance)
  } else camera.aspect = size.width / size.height
  camera.position.copy(offset.multiplyScalar(fit).add(target))
  camera.updateProjectionMatrix()
}

/** Screen-space distance in the plane through the orbit target; physical calibration stays independent of framing. */
export function scaleBar(camera: Camera, target: THREE.Vector3, height: number, metresPerWorldUnit: number, maxPixels = 80) {
  const worldHeight = camera instanceof THREE.PerspectiveCamera
    ? 2 * camera.position.distanceTo(target) * Math.tan(camera.fov * Math.PI / 360) / camera.zoom
    : (camera.top - camera.bottom) / camera.zoom
  const metresPerPixel = worldHeight / height * metresPerWorldUnit
  const maximum = metresPerPixel * maxPixels
  if (!(maximum > 0) || !Number.isFinite(maximum)) return undefined
  const decade = 10 ** Math.floor(Math.log10(maximum))
  const metres = ([5, 2, 1].find(value => value * decade <= maximum) ?? 1) * decade
  const display = formatSI(metres, 'm')!
  return { metres, pixels: metres / metresPerPixel, label: `${display.value} ${display.unit}` }
}
