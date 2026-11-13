import * as THREE from 'three'
import type { Settings } from '../types'
import type { WaveCoefficients } from '../physics/superposition'
import { createHydrogenWavefunction } from '../physics/hydrogen'
import { WAVE_COLORS } from './wave-colors'

export type VolumeQuality = 'optimized' | 'reference'
export const VOLUME_RENDERING = { quality: 'optimized' as VolumeQuality, terminationAlpha: 0.985 }

export const vertexShader = `varying vec3 localPosition;
void main() { localPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
export const fragmentShader = `
precision highp float;
varying vec3 localPosition;
uniform sampler2D radialTable, polarTable;
uniform vec2 firstCoefficient, secondCoefficient, orders;
uniform vec3 positiveReal, negativeReal, positiveImaginary, negativeImaginary;
uniform float radius, paired, quantity, brightness, realBasis, terminationAlpha;
vec2 multiply(vec2 a, vec2 b) { return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec2 azimuth(float m, vec2 direction) {
  if (abs(m) < 0.5) return vec2(1.0, 0.0);
  vec2 value = vec2(1.0, 0.0), power = direction;
  float order = abs(m);
  // Integer powers of (x+iy)/rho preserve phase without atan/sin/cos; six bits cover n <= 50.
  for (int bit = 0; bit < 6; bit++) {
    if (mod(order, 2.0) > 0.5) value = multiply(value, power);
    order = floor(order * 0.5);
    if (order < 0.5) break;
    power = multiply(power, power);
  }
  if (realBasis < 0.5) return vec2(value.x, sign(m) * value.y);
  return vec2(1.41421356237 * (m > 0.0 ? value.x : value.y), 0.0);
}
vec2 waveAt(vec3 position, float distance, float u) {
  vec2 direction = vec2(1.0, 0.0);
  if (abs(orders.x) > 0.5 || (paired > 0.5 && abs(orders.y) > 0.5)) {
    float transverse = dot(position.xy, position.xy);
    if (transverse > 1e-30) direction = position.xy * inversesqrt(transverse);
  }
  vec2 radial = texture2D(radialTable, vec2(distance / 2.4 * (4095.0/4096.0) + 0.5/4096.0, 0.5)).rg;
  vec2 polar = texture2D(polarTable, vec2((u+1.0)*0.5 * (4095.0/4096.0) + 0.5/4096.0, 0.5)).rg;
  vec2 value = multiply(firstCoefficient, radial.x * polar.x * azimuth(orders.x, direction));
  if (paired > 0.5) value += multiply(secondCoefficient, radial.y * polar.y * azimuth(orders.y, direction));
  return value;
}
vec3 colorAt(vec2 psi) {
  if (quantity > 0.5 && quantity < 1.5) return positiveReal;
  if (quantity > 2.5 && quantity < 3.5) return psi.x < 0.0 ? negativeReal : positiveReal;
  if (quantity > 3.5) return psi.y < 0.0 ? negativeImaginary : positiveImaginary;
  return mix(psi.x < 0.0 ? negativeReal : positiveReal, psi.y < 0.0 ? negativeImaginary : positiveImaginary, abs(psi.y)/(abs(psi.x)+abs(psi.y)+1e-20));
}
void main() {
  vec3 direction = normalize(localPosition - cameraPosition);
  vec3 nearPlane = (-vec3(2.4) - cameraPosition) / direction;
  vec3 farPlane = (vec3(2.4) - cameraPosition) / direction;
  vec3 lower = min(nearPlane, farPlane), upper = max(nearPlane, farPlane);
  float start = max(0.0, max(max(lower.x, lower.y), lower.z));
  float finish = min(min(upper.x, upper.y), upper.z);
  if (finish <= start) discard;
  float steps = 112.0;
  float stepLength = (finish - start) / steps;
  float firstSample = 0.0, lastSample = steps;
  #if !REFERENCE_GRID
  // The sphere excludes only points the original shader already rejected; retain its exact midpoint lattice.
  float center = dot(cameraPosition, direction);
  float discriminant = center*center-dot(cameraPosition,cameraPosition)+2.401*2.401;
  if (discriminant <= 0.0) discard;
  float span = sqrt(discriminant);
  float entry = max(start, -center-span), exit = min(finish, -center+span);
  if (exit <= entry) discard;
  firstSample = max(0.0, floor((entry-start)/stepLength-0.5));
  lastSample = min(steps, ceil((exit-start)/stepLength-0.5)+1.0);
  #endif
  float densityScale = radius * radius * radius;
  float amplitudeScale = sqrt(densityScale);
  float opacityScale = stepLength * brightness * 1.6;
  vec4 accumulated = vec4(0.0);
  for (int i = 0; i < 112; i++) {
    float index = firstSample + float(i);
    if (index >= lastSample) break;
    vec3 position = cameraPosition + direction * (start + (index + 0.5) * stepLength);
    float distance = length(position);
    if (distance > 2.4) continue;
    float u = distance > 0.00001 ? position.z / distance : 0.0;
    vec2 psi = waveAt(position, distance, u);
    float probability = dot(psi, psi) * densityScale;
    float weight = sqrt(probability);
    vec3 color = colorAt(psi);
    if (quantity > 0.5 && quantity < 1.5) weight = probability;
    if (quantity > 2.5 && quantity < 3.5) weight = abs(psi.x)*amplitudeScale;
    if (quantity > 3.5) weight = abs(psi.y)*amplitudeScale;
    float alpha = 1.0-exp(-weight * opacityScale);
    accumulated.rgb += (1.0-accumulated.a)*alpha*color;
    accumulated.a += (1.0-accumulated.a)*alpha;
    if (accumulated.a > terminationAlpha) break;
  }
  if (accumulated.a < 0.002) discard;
  gl_FragColor = vec4(accumulated.rgb / accumulated.a, accumulated.a);
  #include <colorspace_fragment>
}`

export function createVolumeResources(s: Settings, radius: number) {
  const wave = createHydrogenWavefunction(s)
  const channels = wave.paired ? 2 : 1
  const texture = (evaluate: (x: number) => [number, number], min: number, max: number) => {
    // Preserve float32 amplitudes; filter only the basis channels that participate in the wavefunction.
    const length = 4096, values = new Float32Array(length * channels)
    for (let i = 0; i < length; i++) {
      const [a, b] = evaluate(min + (max - min) * i / (length - 1))
      values[channels * i] = a
      if (wave.paired) values[channels * i + 1] = b
    }
    const result = new THREE.DataTexture(values, length, 1, wave.paired ? THREE.RGFormat : THREE.RedFormat, THREE.FloatType)
    result.minFilter = result.magFilter = THREE.LinearFilter; result.needsUpdate = true
    return result
  }
  const radial = texture(r => [wave.first.radial(r), wave.second.radial(r)], 0, radius)
  const polar = texture(u => [wave.first.polar(u), wave.second.polar(u)], -1, 1)
  return { radial, polar, paired: wave.paired, real: wave.basis === 'real' }
}

export type VolumeResources = ReturnType<typeof createVolumeResources>

export function createVolumeMaterial(resources: VolumeResources, radius: number, s: Settings, quality: VolumeQuality = VOLUME_RENDERING.quality) {
  return new THREE.ShaderMaterial({ vertexShader, fragmentShader, defines: { REFERENCE_GRID: Number(quality === 'reference') }, side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: {
      radialTable: { value: resources.radial }, polarTable: { value: resources.polar }, radius: { value: radius }, paired: { value: Number(resources.paired) },
      firstCoefficient: { value: new THREE.Vector2(1, 0) }, secondCoefficient: { value: new THREE.Vector2(0, 0) }, orders: { value: new THREE.Vector2(s.m, s.m2) },
      positiveReal: { value: new THREE.Color(WAVE_COLORS.realPositive) }, negativeReal: { value: new THREE.Color(WAVE_COLORS.realNegative) },
      positiveImaginary: { value: new THREE.Color(WAVE_COLORS.imaginaryPositive) }, negativeImaginary: { value: new THREE.Color(WAVE_COLORS.imaginaryNegative) },
      quantity: { value: 0 }, brightness: { value: 0.2 },
      terminationAlpha: { value: VOLUME_RENDERING.terminationAlpha },
      realBasis: { value: Number(resources.real) },
    },
  })
}

export function updateVolumeMaterial(material: THREE.ShaderMaterial, resources: VolumeResources, s: Settings, radius: number, c?: WaveCoefficients) {
  material.uniforms.radialTable.value = resources.radial
  material.uniforms.polarTable.value = resources.polar
  material.uniforms.radius.value = radius
  material.uniforms.paired.value = Number(resources.paired)
  material.uniforms.realBasis.value = Number(resources.real)
  material.uniforms.orders.value.set(s.m, s.m2)
  material.uniforms.firstCoefficient.value.set(c?.first.re ?? 1, c?.first.im ?? 0)
  material.uniforms.secondCoefficient.value.set(c?.second.re ?? 0, c?.second.im ?? 0)
  // Retain shader indices for comparison with the frozen reference renderer.
  material.uniforms.quantity.value = { magnitude: 0, probability: 1, real: 3, imaginary: 4 }[s.surfaceQuantity]
  material.uniforms.brightness.value = s.volumeBrightness / 5
}

