import { Component, useCallback, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { SceneKind, Settings } from '../types'
import { HBAR, ELECTRON_VOLT } from '../physics/quantum'
import { BOHR_RADIUS, displayRadius, RYDBERG_EV } from '../physics/hydrogen'
import { ElectronEnsemble, MAX_ELECTRONS, type SampleStatistics } from '../physics/sampling'
import { QUANTUM_TIME_SCALE, type QuantumTimeline } from '../physics/evolution'
import { dipoleExpectation, electricField, electromagneticWave, transitionDipole, transitionRates, validateTransition } from '../physics/transition'
import { initialCoefficients } from '../physics/superposition'
import { applyCameraView, cameraFit, CAMERA_FOV, electronPointSize, INITIAL_CAMERA, MIN_CAMERA_DISTANCE, orthographicViewZoom, readCameraView, scaleBar, type CameraView, type ViewportSize } from '../rendering/camera'
import { OrbitalVolume } from '../rendering/OrbitalVolume'
import { getElectronColor } from '../rendering/colors'
import { createElectronSprite, ELECTRON_ALPHA_TEST } from '../rendering/electron-sprite'
import { formatSI } from '../formatting'
type Vec3 = [number, number, number]
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const SYNC = new EventTarget()
interface CameraDetail extends CameraView { source: string }
/** Canvas sprites keep labels in the same renderer lifecycle as their scene. */
function AxisLabel({ position, children, momentum = false, color, hideNearAxis, size = 0.25 }: { position: Vec3; children: string; momentum?: boolean; color?: string; hideNearAxis?: 'x' | 'y' | 'z'; size?: number }) {
  const sprite = useRef<THREE.Sprite>(null)
  const viewDirection = useMemo(() => new THREE.Vector3(), [])
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    context.font = momentum ? 'italic 76px Georgia' : '500 70px Arial'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = color ?? (momentum ? '#f0be8b' : '#8da6b6')
    context.fillText(children, 64, 64)
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    return result
  }, [children, momentum, color])
  useEffect(() => () => texture.dispose(), [texture])
  useFrame(({ camera }) => {
    if (!hideNearAxis || !sprite.current) return
    // Fade between 6° and 3° from the label's positive axis before the nearby sprite dominates the view.
    const topAlignment = -camera.getWorldDirection(viewDirection)[hideNearAxis]
    const opacity = 1 - THREE.MathUtils.smoothstep(topAlignment, Math.cos(6 * THREE.MathUtils.DEG2RAD), Math.cos(3 * THREE.MathUtils.DEG2RAD))
    sprite.current.material.opacity = opacity
    sprite.current.visible = opacity > 0
  })
  return <sprite ref={sprite} position={position} scale={[size, size, 1]} renderOrder={10}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} /></sprite>
}

function CameraController({ settings, id, fitScale, sizeReference, onSize }: { settings: Settings; id: string; fitScale: number; sizeReference?: ViewportSize; onSize?: (size: ViewportSize) => void }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const busy = useRef(false)
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  useEffect(() => { if (size.width > 0 && size.height > 0) onSize?.({ width: size.width, height: size.height }) }, [onSize, size.width, size.height])
  // A shared viewport reference keeps the Bohr and cloud physical scales equal.
  const fit = cameraFit(size, fitScale, sizeReference)
  const baseZoom = orthographicViewZoom(size.height, fit)
  const saved = useRef<CameraView>({ position: [...INITIAL_CAMERA], target: [0, 0, 0] })
  const previousReset = useRef(-1)
  const appliedCamera = useRef<typeof camera | null>(null)
  const applyView = useCallback((view: CameraView) => {
    busy.current = true
    camera.up.set(0, 0, 1)
    camera.far = 80 * Math.max(1, fitScale)
    applyCameraView(camera, view, fit, baseZoom, size)
    controls.current?.target.fromArray(view.target)
    controls.current?.update()
    appliedCamera.current = camera
    busy.current = false
  }, [camera, fit, baseZoom, fitScale, size.width, size.height])
  useEffect(() => {
    if (previousReset.current !== settings.cameraReset) {
      saved.current = { position: [...INITIAL_CAMERA], target: [0, 0, 0] }
      previousReset.current = settings.cameraReset
    }
    applyView(saved.current)
  }, [applyView, settings.cameraReset])
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<CameraDetail>).detail
      if (detail.source === id) return
      saved.current = detail
      applyView(detail)
    }
    SYNC.addEventListener('camera', sync)
    return () => SYNC.removeEventListener('camera', sync)
  }, [applyView, id])
  const referenceDistance = Math.hypot(...INITIAL_CAMERA)
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} minDistance={MIN_CAMERA_DISTANCE * fit} maxDistance={16 * fit} minZoom={baseZoom * referenceDistance / 16} maxZoom={baseZoom * referenceDistance / MIN_CAMERA_DISTANCE}
    onChange={() => {
      if (!busy.current && appliedCamera.current === camera && controls.current) {
        const view = readCameraView(camera, controls.current.target, fit, baseZoom)
        saved.current = view
        SYNC.dispatchEvent(new CustomEvent('camera', { detail: { source: id, ...view } }))
      }
    }} />
}

function ZoomScale({ element, radius }: { element: RefObject<HTMLDivElement | null>; radius: number }) {
  const origin = useMemo(() => new THREE.Vector3(), [])
  const last = useRef('')
  useFrame(({ camera, size, controls }) => {
    if (!element.current) return
    const target = (controls as OrbitControlsImpl | null)?.target ?? origin
    const scale = scaleBar(camera as THREE.PerspectiveCamera | THREE.OrthographicCamera, target, size.height, radius * BOHR_RADIUS / 2.4, Math.min(80, size.width * 0.3))
    if (!scale) return
    const key = `${scale.label}:${scale.pixels.toFixed(2)}`
    if (key === last.current) return
    last.current = key
    element.current.style.setProperty('--scale-width', `${scale.pixels}px`)
    element.current.dataset.metres = String(scale.metres)
    element.current.setAttribute('aria-label', `Scale: ${scale.label} at the view center`)
    element.current.querySelector('span')!.textContent = scale.label
  })
  return null
}

function Laboratory() {
  return <>
    <ambientLight intensity={1} />
    <gridHelper args={[16, 32, '#263647', '#14202c']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -2.6]} material-transparent material-opacity={0.23} />
    <Line points={[[-2.55, 0, 0], [2.65, 0, 0]]} color="#ff6666" lineWidth={0.8} transparent opacity={0.4} dashed dashSize={0.06} gapSize={0.06} />
    <Line points={[[0, -2.55, 0], [0, 2.65, 0]]} color="#65dc78" lineWidth={0.8} transparent opacity={0.4} dashed dashSize={0.06} gapSize={0.06} />
    <Line points={[[0, 0, -2.55], [0, 0, 2.65]]} color="#6e8cff" lineWidth={0.8} transparent opacity={0.45} dashed dashSize={0.06} gapSize={0.06} />
    <AxisLabel position={[2.85, 0, 0]} hideNearAxis="x" color="#ff6666">x</AxisLabel>
    <AxisLabel position={[0, 2.85, 0]} hideNearAxis="y" color="#65dc78">y</AxisLabel>
    <AxisLabel position={[0, 0, 2.85]} hideNearAxis="z" color="#6e8cff">z</AxisLabel>
    <mesh renderOrder={5}><sphereGeometry args={[0.045, 16, 12]} /><meshBasicMaterial color="#ffb547" depthTest={false} /></mesh>
  </>
}
function QuantumEnsemble({ settings: s, onStats, timeline, radius }: { settings: Settings; onStats: (s: SampleStatistics) => void; timeline: QuantumTimeline; radius: number }) {
  const geometry = useRef<THREE.BufferGeometry>(null)
  const material = useRef<THREE.PointsMaterial>(null)
  const origin = useMemo(() => new THREE.Vector3(), [])
  const engine = useMemo(() => new ElectronEnsemble(s), [s.n, s.l, s.m, s.n2, s.l2, s.m2, s.orbitalBasis, s.superposition, s.coherentTransition, s.seed])
  const scaled = useMemo(() => new Float32Array(MAX_ELECTRONS * 3), [])
  const timing = useRef({ sample: 0, stats: 0, pending: false })
  const write = () => {
    engine.sample(s.count, timeline.frame.coefficients)
    for (let i = 0; i < engine.count * 3; i++) scaled[i] = engine.positions[i] * 2.4 / radius
    if (geometry.current) {
      geometry.current.setDrawRange(0, engine.count)
      geometry.current.getAttribute('position').needsUpdate = true
    }
    timing.current.pending = true
  }
  const record = () => {
    if (!timing.current.pending) return
    engine.record(); onStats(engine.statistics()); timing.current.pending = false
  }
  useEffect(() => { write(); record() }, [engine, s.count, s.regenerate, s.transitionRun, radius])
  useEffect(() => { engine.resetStatistics(); onStats(engine.statistics()) }, [engine, s.resetStats, onStats])
  useFrame(({ camera, controls, size }, delta) => {
    const target = (controls as OrbitControlsImpl | null)?.target ?? origin
    if (material.current) material.current.size = electronPointSize(s.visualDensity, camera, target, size)
    timing.current.sample += delta; timing.current.stats += delta
    // Drop missed batches after backgrounding; do not block the UI to catch up.
    if (!s.ensemblePaused && timing.current.sample >= 1 / s.frequency) { timing.current.sample %= 1 / s.frequency; write() }
    if (timing.current.stats >= 1 / s.histogramFrequency) { timing.current.stats %= 1 / s.histogramFrequency; record() }
  })
  const sprite = useMemo(createElectronSprite, [])
  useEffect(() => () => sprite.dispose(), [sprite])
  return <points frustumCulled={false}>
    <bufferGeometry ref={geometry}><bufferAttribute attach="attributes-position" args={[scaled, 3]} /></bufferGeometry>
    <pointsMaterial ref={material} color={getElectronColor(s)} size={4 * s.visualDensity} sizeAttenuation={false} transparent opacity={s.electronOpacity} depthWrite={false} map={sprite} alphaTest={s.electronOpacity * ELECTRON_ALPHA_TEST} blending={THREE.AdditiveBlending} />
  </points>
}
function BohrOrbit({ settings: s, second = false, radius }: { settings: Settings; second?: boolean; radius: number }) {
  const electron = useRef<THREE.Mesh>(null), angle = useRef(second ? Math.PI : 0)
  const n = second ? s.n2 : s.n, orbitRadius = n * n * 2.4 / radius
  const color = second ? '#8faaf0' : '#ffb547'
  const points = useMemo(() => Array.from({ length: 161 }, (_, i) => [orbitRadius * Math.cos(i * Math.PI / 80), orbitRadius * Math.sin(i * Math.PI / 80), 0] as Vec3), [orbitRadius])
  useFrame((_, delta) => {
    angle.current += Math.min(delta, 0.1) * s.playback * QUANTUM_TIME_SCALE * 2 * RYDBERG_EV * ELECTRON_VOLT / (HBAR * n ** 3)
    electron.current?.position.set(orbitRadius * Math.cos(angle.current), orbitRadius * Math.sin(angle.current), 0)
  })
  return <><Line points={points} color={color} transparent opacity={0.65} lineWidth={1.1} /><mesh ref={electron}><sphereGeometry args={[0.075, 16, 12]} /><meshBasicMaterial color={color} /></mesh></>
}
function DrivenField({ settings, timeline }: { settings: Settings; timeline: QuantumTimeline }) {
  const electricLabel = useRef<THREE.Group>(null), dipoleLabel = useRef<THREE.Group>(null)
  const arrows = useMemo(() => [new THREE.ArrowHelper(Y_AXIS, new THREE.Vector3(), 1, '#35d3e4'), new THREE.ArrowHelper(Y_AXIS, new THREE.Vector3(), 1, '#ffb547')], [])
  const vector = useMemo(() => new THREE.Vector3(), [])
  const wave = useMemo(() => {
    const group = new THREE.Group()
    group.name = 'electromagnetic-wave'
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(161 * 3), 3).setUsage(THREE.DynamicDrawUsage))
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#35d3e4', transparent: true, opacity: 0.75, toneMapped: false }))
    line.name = 'electric-wave'
    line.frustumCulled = false
    group.add(line)
    const propagation = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 5.2, '#78cda0', 0.2, 0.1)
    group.add(propagation)
    return { group, line, propagation }
  }, [])
  const angularDipole = useMemo(() => transitionDipole(settings), [settings.n, settings.l, settings.m, settings.n2, settings.l2, settings.m2, settings.polarization, settings.orbitalBasis])
  const allowed = validateTransition(settings).allowed, rates = transitionRates(settings), resonance = rates.resonance
  const linear = settings.polarization === 'pi'
  useEffect(() => () => arrows.forEach(arrow => arrow.dispose()), [arrows])
  useEffect(() => () => {
    wave.line.geometry.dispose(); wave.line.material.dispose()
    wave.propagation.dispose()
  }, [wave])
  useFrame(() => {
    const frame = timeline.frame
    wave.group.visible = allowed
    if (allowed) {
      const wavelength = rates.photonWavelength
      for (let i = 0; i < 161; i++) {
        const distance = (i / 160 * 2 - 1) * 2.5
        // One wavelength spans three display units; physical phase still follows the shared clock.
        const field = electromagneticWave(settings, resonance, frame.time, settings.drivePhase, distance * wavelength / 3, angularDipole).electric
        wave.line.geometry.getAttribute('position').setXYZ(i, (linear ? distance : 0) + field.x * 2.2, field.y * 2.2, (linear ? 0 : distance) + field.z * 2.2)
      }
      wave.line.geometry.getAttribute('position').needsUpdate = true
      vector.set(linear ? 1 : 0, 0, linear ? 0 : 1)
      wave.propagation.setDirection(vector); wave.propagation.position.copy(vector).multiplyScalar(-2.6)
    }
    const field = allowed ? electricField(settings, resonance, frame.time, settings.drivePhase, angularDipole) : { x: 0, y: 0, z: 0 }
    const dipole = dipoleExpectation(settings, frame.coefficients ?? initialCoefficients, angularDipole)
    const updateArrow = (index: number, value: typeof field, scale: number, label: THREE.Group | null) => {
      vector.set(value.x, value.y, value.z).multiplyScalar(scale)
      const length = vector.length() * 2.2, visible = length > 1e-8
      arrows[index].visible = visible
      if (label) label.visible = visible
      if (!visible) return
      vector.normalize(); arrows[index].setDirection(vector)
      arrows[index].setLength(length, Math.min(0.24, length * 0.3), Math.min(0.13, length * 0.16))
      label?.position.copy(vector).multiplyScalar(length + 0.22)
    }
    updateArrow(0, field, 1, electricLabel.current)
    updateArrow(1, dipole, Math.abs(angularDipole) > 0 ? 1 / Math.abs(angularDipole) : 0, dipoleLabel.current)
  })
  return <group scale={0.5}>
    {arrows.map((arrow, index) => <primitive key={index} object={arrow} />)}
    <primitive object={wave.group} />
    {allowed && <AxisLabel size={0.5} position={linear ? [3.05, 0, 0.25] : [0.25, 0, 3.05]} color="#78cda0">k</AxisLabel>}
    <group ref={electricLabel}><AxisLabel size={0.5} position={[0, 0, 0]} color="#35d3e4">E</AxisLabel></group>
    <group ref={dipoleLabel}><AxisLabel size={0.5} position={[0, 0, 0]} momentum color="#ffb547">μ</AxisLabel></group>
  </group>
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="webgl-fallback"><strong>3D rendering is unavailable</strong><p>Enable WebGL / hardware acceleration, then reload. The physics controls and calculations remain available.</p></div> : this.props.children }
}

function FrameRate({ onFPS }: { onFPS: (fps: number) => void }) {
  const count = useRef(0), elapsed = useRef(0)
  useFrame((_, delta) => { count.current++; elapsed.current += delta; if (elapsed.current >= 1) { onFPS(Math.round(count.current / elapsed.current)); count.current = 0; elapsed.current = 0 } })
  return null
}


export function Scene({ mode, settings, onStats, id, onFPS, timeline, sizeReference, onSize }: { mode: SceneKind; settings: Settings; onStats: (s: SampleStatistics) => void; id: string; onFPS?: (fps: number) => void; timeline: QuantumTimeline; sizeReference?: ViewportSize; onSize?: (size: ViewportSize) => void }) {
  const scale = useRef<HTMLDivElement>(null)
  const radius = displayRadius(settings)
  const bohrRadii = [settings.n ** 2, ...(settings.superposition ? [settings.n2 ** 2] : [])]
  const bohrRadius = Math.max(...bohrRadii)
  const shownRadius = mode === 'classical' ? bohrRadius : radius
  return <div className="canvas-container" data-testid={`scene-${mode}`} data-electron-count={mode === 'ensemble' ? settings.count : undefined} data-radius-a0={shownRadius} data-n={settings.n} data-l={settings.l} data-m={settings.m} data-orbital-basis={settings.orbitalBasis}>
    <SceneBoundary><Canvas dpr={[1, 1.25]} camera={{ position: INITIAL_CAMERA, up: [0, 0, 1], fov: CAMERA_FOV, near: 0.1, far: 80 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      {mode === 'field' && <OrthographicCamera makeDefault manual position={INITIAL_CAMERA} up={[0, 0, 1]} near={0.1} far={80} />}
      <Laboratory />
      <CameraController settings={settings} id={id} fitScale={1} sizeReference={mode === 'classical' ? sizeReference : undefined} onSize={onSize} />
      {mode !== 'field' && <ZoomScale element={scale} radius={radius} />}
      {mode === 'wavefunction' && <OrbitalVolume settings={settings} timeline={timeline} radius={radius} />}
      {mode === 'ensemble' && <QuantumEnsemble settings={settings} onStats={onStats} timeline={timeline} radius={radius} />}
      {mode === 'classical' && <><BohrOrbit settings={settings} radius={radius} />{settings.superposition && <BohrOrbit settings={settings} second radius={radius} />}</>}
      {mode === 'field' && <DrivenField settings={settings} timeline={timeline} />}
      {onFPS && <FrameRate onFPS={onFPS} />}
    </Canvas></SceneBoundary>
    {mode !== 'field' && <div className="physical-scale"><div ref={scale} className="scale-readout" role="img" aria-label="Spatial scale" title="Length in the screen plane through the view center"><i className="scale-bar" /><span /></div>
      {mode === 'classical' ? <div className="physical-extent" title="Actual Bohr orbit radius from the proton">{bohrRadii.map((value, index) => {
        const length = formatSI(value * BOHR_RADIUS, 'm')!
        return <span key={index}>r{settings.superposition && <sub>{index + 1}</sub>} = {value} a₀ · {length.value} {length.unit}</span>
      })}</div> : <div className="physical-extent">Display radius {shownRadius.toFixed(1)} a₀</div>}
    </div>}
    {mode === 'wavefunction' && !settings.timeEvolution && !settings.coherentTransition && settings.surfaceQuantity === 'imaginary' && (settings.orbitalBasis === 'real' || settings.m === 0 && (!settings.superposition || settings.m2 === 0)) && <div className="zero-component">Im(ψ) = 0<span>This state is purely real at t = 0.</span></div>}
  </div>
}
