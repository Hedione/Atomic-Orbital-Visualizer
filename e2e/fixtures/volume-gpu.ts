import * as THREE from 'three'
import { defaultSettings, type Settings } from '../../src/types'
import { createHydrogenWavefunction, displayRadius } from '../../src/physics/hydrogen'
import type { WaveCoefficients } from '../../src/physics/superposition'
import { QuantumTimeline } from '../../src/physics/evolution'
import { createVolumeMaterial, createVolumeResources, updateVolumeMaterial, fragmentShader } from '../../src/rendering/volume-material'
import { fragmentShader as referenceFragment, vertexShader as referenceVertex } from './volume-reference'
import { INITIAL_CAMERA, CAMERA_FOV } from '../../src/rendering/camera'

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(850, 362)
renderer.setClearColor('#050b10')
document.body.style.margin = '0'
document.body.append(renderer.domElement)
const gl = renderer.getContext() as WebGL2RenderingContext
const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2')
const debug = gl.getExtension('WEBGL_debug_renderer_info')
const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 850 / 362, 0.1, 80)
camera.up.set(0, 0, 1)
camera.position.set(...INITIAL_CAMERA)
camera.lookAt(0, 0, 0)
const scene = new THREE.Scene()
const geometry = new THREE.BoxGeometry(4.8, 4.8, 4.8)
let settings = { ...defaultSettings }, radius = displayRadius(settings)
let resources = createVolumeResources(settings, radius)
function legacyResources() {
  const expand = (texture: THREE.DataTexture) => {
    const source = texture.image.data, data = new Float32Array(4096 * 4), stride = source.length / 4096
    for (let i = 0; i < 4096; i++) { data[i * 4] = source[i * stride]; data[i * 4 + 1] = stride > 1 ? source[i * stride + 1] : 0; data[i * 4 + 3] = 1 }
    const result = new THREE.DataTexture(data, 4096, 1, THREE.RGBAFormat, THREE.FloatType)
    result.minFilter = result.magFilter = THREE.LinearFilter; result.needsUpdate = true
    return result
  }
  return { ...resources, radial: expand(resources.radial), polar: expand(resources.polar) }
}
let originalResources = legacyResources()
const optimized = createVolumeMaterial(resources, radius, settings)
const reference = createVolumeMaterial(resources, radius, settings)
reference.vertexShader = referenceVertex; reference.fragmentShader = referenceFragment
const packedOnly = createVolumeMaterial(resources, radius, settings)
packedOnly.vertexShader = referenceVertex; packedOnly.fragmentShader = referenceFragment
const fallback = createVolumeMaterial(resources, radius, settings, 'reference')
const mesh = new THREE.Mesh(geometry, optimized)
scene.add(mesh)

function select(patch: Partial<Settings>, coefficients?: WaveCoefficients, angle = 0) {
  settings = { ...defaultSettings, ...patch }
  radius = displayRadius(settings)
  resources.radial.dispose(); resources.polar.dispose()
  originalResources.radial.dispose(); originalResources.polar.dispose()
  resources = createVolumeResources(settings, radius)
  originalResources = legacyResources()
  const c = coefficients ?? createHydrogenWavefunction(settings).defaults
  updateVolumeMaterial(optimized, resources, settings, radius, c)
  updateVolumeMaterial(reference, originalResources, settings, radius, c)
  updateVolumeMaterial(packedOnly, resources, settings, radius, c)
  updateVolumeMaterial(fallback, resources, settings, radius, c)
  camera.position.set(...INITIAL_CAMERA).applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
  camera.lookAt(0, 0, 0)
}

function draw(material: THREE.ShaderMaterial) { mesh.material = material; renderer.render(scene, camera) }
function pixels(material: THREE.ShaderMaterial) {
  draw(material)
  const data = new Uint8Array(850 * 362 * 4)
  gl.readPixels(0, 0, 850, 362, gl.RGBA, gl.UNSIGNED_BYTE, data)
  return data
}

function compare(patch: Partial<Settings>, coefficients?: WaveCoefficients, angle = 0, fullGrid = false) {
  select(patch, coefficients, angle)
  const before = pixels(reference), after = pixels(fullGrid ? fallback : optimized)
  let max = 0, sum = 0, squares = 0, changedPixels = 0, foregroundPixels = 0
  for (let i = 0; i < before.length; i += 4) {
    let pixelMax = 0
    const foreground = Math.max(before[i], after[i]) > 7 || Math.max(before[i + 1], after[i + 1]) > 13 || Math.max(before[i + 2], after[i + 2]) > 18
    if (foreground) foregroundPixels++
    for (let channel = 0; channel < 3; channel++) {
      const error = Math.abs(before[i + channel] - after[i + channel])
      max = Math.max(max, error); sum += error; squares += error * error; pixelMax = Math.max(pixelMax, error)
    }
    if (pixelMax > 3) changedPixels++
  }
  return { max, mean: sum / (850 * 362 * 3), rmse: Math.sqrt(squares / (850 * 362 * 3)), changedPixels, foregroundPixels, glError: gl.getError() }
}

async function benchmark(patch: Partial<Settings>, count = 30, discard = false, animate = false, ablate = false) {
  select(patch)
  if (discard) gl.enable(gl.RASTERIZER_DISCARD)
  const results = []
  const variants = ablate ? [['before', reference], ['packed-only', packedOnly], ['after', optimized]] as const : [['before', reference], ['after', optimized]] as const
  for (const [name, material] of variants) {
    for (let i = 0; i < 8; i++) draw(material)
    gl.finish()
    const cpu: number[] = [], gpu: number[] = []
    let disjoint = 0, unavailable = 0
    const timeline = new QuantumTimeline(); timeline.configure(settings, 0)
    for (let i = 0; i < count; i++) {
      const query = timer ? gl.createQuery() : null
      if (animate) updateVolumeMaterial(material, material === reference ? originalResources : resources, settings, radius, timeline.read(i * 1000 / 60).coefficients)
      if (timer && query) { gl.getParameter(timer.GPU_DISJOINT_EXT); gl.beginQuery(timer.TIME_ELAPSED_EXT, query) }
      const start = performance.now()
      draw(material)
      cpu.push(performance.now() - start)
      if (timer && query) gl.endQuery(timer.TIME_ELAPSED_EXT)
      if (timer && query) {
        let available = false, invalid = false
        for (let poll = 0; poll < 120; poll++) {
          await new Promise(resolve => setTimeout(resolve, 0))
          invalid = Boolean(gl.getParameter(timer.GPU_DISJOINT_EXT))
          available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)
          if (invalid || available) break
        }
        if (!invalid && available) gpu.push(Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6)
        else if (invalid) disjoint++
        else unavailable++
        gl.deleteQuery(query)
      }
    }
    const summary = (values: number[]) => values.length ? { meanMs: values.reduce((a, b) => a + b, 0) / values.length, medianMs: values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)], samples: values.length } : null
    results.push({ name, submission: summary(cpu), gpu: summary(gpu), disjoint, unavailable })
  }
  if (discard) gl.disable(gl.RASTERIZER_DISCARD)
  return { results, memory: { beforeTextureBytes: originalResources.radial.image.data.byteLength + originalResources.polar.image.data.byteLength, textureBytes: resources.radial.image.data.byteLength + resources.polar.image.data.byteLength, renderer: renderer.info.memory }, glError: gl.getError() }
}

function fieldComparison(patch: Partial<Settings>, coefficients?: WaveCoefficients) {
  select(patch, coefficients)
  const count = 512, points = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    const r = 2.399 * (i % 19) / 18, u = (i % 17) / 8 - 1, phi = i * 2.3999632297
    const transverse = r * Math.sqrt(Math.max(0, 1 - u * u))
    points[4 * i] = transverse * Math.cos(phi); points[4 * i + 1] = transverse * Math.sin(phi); points[4 * i + 2] = r * u
  }
  const texture = new THREE.DataTexture(points, count, 1, THREE.RGBAFormat, THREE.FloatType)
  texture.needsUpdate = true
  const target = new THREE.WebGLRenderTarget(count, 1, { type: THREE.FloatType, format: THREE.RGBAFormat })
  const fieldScene = new THREE.Scene(), plane = new THREE.PlaneGeometry(2, 2)
  const outputs: Float32Array[] = []
  for (const [source, uniforms, original] of [[referenceFragment, reference.uniforms, true], [fragmentShader, optimized.uniforms, false], [referenceFragment, packedOnly.uniforms, true]] as const) {
    const material = new THREE.ShaderMaterial({
      vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
      fragmentShader: source.slice(0, source.indexOf('void main()')) + `uniform sampler2D probePoints; void main() { vec3 p = texture2D(probePoints, vec2(gl_FragCoord.x/${count}.0,0.5)).xyz; float r = length(p); float u = r > 0.00001 ? p.z/r : 0.0; vec2 psi = ${original ? 'waveAt(p)' : 'waveAt(p,r,u)'}; gl_FragColor = vec4(psi,0.0,1.0); }`,
      uniforms: { ...uniforms, probePoints: { value: texture } },
    })
    fieldScene.add(new THREE.Mesh(plane, material))
    renderer.setRenderTarget(target); renderer.render(fieldScene, camera)
    const values = new Float32Array(count * 4); renderer.readRenderTargetPixels(target, 0, 0, count, 1, values); outputs.push(values)
    fieldScene.clear(); material.dispose()
  }
  renderer.setRenderTarget(null)
  texture.dispose(); target.dispose(); plane.dispose()
  let maxError = 0, peak = 0, packedError = 0, arithmeticError = 0, beforeAnalyticError = 0, afterAnalyticError = 0
  const wave = createHydrogenWavefunction(settings)
  for (let i = 0; i < count; i++) {
    maxError = Math.max(maxError, Math.hypot(outputs[0][4 * i] - outputs[1][4 * i], outputs[0][4 * i + 1] - outputs[1][4 * i + 1]))
    peak = Math.max(peak, Math.hypot(outputs[0][4 * i], outputs[0][4 * i + 1]))
    packedError = Math.max(packedError, Math.hypot(outputs[0][4 * i] - outputs[2][4 * i], outputs[0][4 * i + 1] - outputs[2][4 * i + 1]))
    arithmeticError = Math.max(arithmeticError, Math.hypot(outputs[1][4 * i] - outputs[2][4 * i], outputs[1][4 * i + 1] - outputs[2][4 * i + 1]))
    const x = points[4 * i], y = points[4 * i + 1], z = points[4 * i + 2], r = Math.hypot(x, y, z)
    const expected = wave.evaluate(r * radius / 2.4, r > 0.00001 ? z / r : 0, Math.atan2(y, x), coefficients)
    beforeAnalyticError = Math.max(beforeAnalyticError, Math.hypot(outputs[0][4 * i] - expected.re, outputs[0][4 * i + 1] - expected.im))
    afterAnalyticError = Math.max(afterAnalyticError, Math.hypot(outputs[1][4 * i] - expected.re, outputs[1][4 * i + 1] - expected.im))
  }
  return { maxError, peak, relativeToPeak: maxError / (peak || 1), packedRelativeError: packedError / (peak || 1), arithmeticRelativeError: arithmeticError / (peak || 1), beforeAnalyticError: beforeAnalyticError / (peak || 1), afterAnalyticError: afterAnalyticError / (peak || 1), glError: gl.getError() }
}

function sampleCounts(patch: Partial<Settings>) {
  select(patch)
  const results = []
  for (const [name, original] of [['before', true], ['after', false]] as const) {
    const base = original ? reference : optimized
    const source = base.fragmentShader
      .replace('vec4 accumulated = vec4(0.0);', 'vec4 accumulated = vec4(0.0); float sampleCount = 0.0;')
      .replace('vec3 position = cameraPosition + direction', 'sampleCount += 1.0; vec3 position = cameraPosition + direction')
      .replace('if (accumulated.a < 0.002) discard;', 'gl_FragColor = vec4(sampleCount/112.0,0.0,0.0,1.0); return;')
    const material = new THREE.ShaderMaterial({ vertexShader: referenceVertex, fragmentShader: source, defines: base.defines, uniforms: base.uniforms, side: THREE.BackSide })
    const data = pixels(material)
    let total = 0, covered = 0, max = 0
    for (let i = 0; i < data.length; i += 4) {
      // Counter output bypasses color-space conversion and uses linear byte values.
      const value = Math.round(data[i] / 255 * 112)
      if (value > 0 && data[i + 1] === 0 && data[i + 2] === 0) { total += value; covered++; max = Math.max(max, value) }
    }
    results.push({ name, meanIterations: total / (covered || 1), maxIterations: max, coveredPixels: covered, iterationPixels: total })
    material.dispose()
  }
  return results
}

const api = {
  device: { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), timerSupported: Boolean(timer), buffer: [850, 362] },
  compare, benchmark, fieldComparison, sampleCounts,
  image(patch: Partial<Settings>, before: boolean, coefficients?: WaveCoefficients, angle = 0) { select(patch, coefficients, angle); draw(before ? reference : optimized); return renderer.domElement.toDataURL() },
}
declare global { interface Window { volumeGPU: typeof api } }
window.volumeGPU = api
