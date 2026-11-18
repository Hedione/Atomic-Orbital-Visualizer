import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Expand, Layers3, MousePointer2, Orbit, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Controls, type UpdateSettings } from './components/Controls'
import { LiveDiagnostics as Diagnostics } from './components/Diagnostics'
import { PhysicsPanel } from './components/PhysicsPanel'
import { Scene } from './components/Scene'
import { EnsembleControls, WavefunctionControls } from './components/SceneControls'
import { emptyStatistics, type SampleStatistics } from './physics/sampling'

import { createStatisticsStore } from './store/statistics'


import { defaultSettings, surfaceColorMode, type Orbital, type Settings, type SurfaceQuantity } from './types'
import { QuantumTimeline } from './physics/evolution'
import { addEffect } from '@react-three/fiber'
import { WAVE_COLORS } from './rendering/wave-colors'
import { ComparisonPanel } from './components/ComparisonPanel'
import { INITIAL_CAMERA, type CameraLink, type ViewportSize } from './rendering/camera'
import { FieldShiftModule } from './components/FieldShiftModule'
import { useKeyboardShortcut } from './useKeyboardShortcut'

export default function App() {
  const [storedSettings, setSettings] = useState<Settings>(defaultSettings)
  const mode = storedSettings.mode ?? (storedSettings.coherentTransition ? 'transition' : storedSettings.superposition ? 'superposition' : 'static')
  // Fill newly added controls when Vite preserves an older state during refresh.
  const settings: Settings = { ...defaultSettings, ...storedSettings, mode, fieldShift: storedSettings.fieldShift ?? defaultSettings.fieldShift, superposition: mode === 'superposition', coherentTransition: mode === 'transition', volumeBrightness: Math.min(10, storedSettings.volumeBrightness ?? defaultSettings.volumeBrightness), surfaceQuantity: ['magnitude', 'probability', 'real', 'imaginary'].includes(storedSettings.surfaceQuantity) ? storedSettings.surfaceQuantity : defaultSettings.surfaceQuantity }

  const viewSettings = settings.mode === 'fields' ? { ...settings, ensemblePaused: true } : settings
  const [timeline] = useState(() => new QuantumTimeline())
  const evolving = settings.mode !== 'fields' && (viewSettings.coherentTransition || viewSettings.timeEvolution)
  const colorMode = surfaceColorMode(viewSettings.surfaceQuantity)
  const colorLegend = colorMode === 'phase' ? 'Complex phase' : colorMode === 'sign' ? 'Sign · positive / negative' : 'Probability density · |ψ|²'
  const signColors = viewSettings.surfaceQuantity === 'real' ? [WAVE_COLORS.realPositive, WAVE_COLORS.realNegative] : [WAVE_COLORS.imaginaryPositive, WAVE_COLORS.imaginaryNegative]
  const colorBackground = colorMode === 'phase' ? `linear-gradient(90deg, ${WAVE_COLORS.realNegative}, ${WAVE_COLORS.imaginaryNegative}, ${WAVE_COLORS.realPositive}, ${WAVE_COLORS.imaginaryPositive}, ${WAVE_COLORS.realNegative})` : colorMode === 'sign' ? `linear-gradient(90deg, ${signColors[0]} 50%, ${signColors[1]} 50%)` : WAVE_COLORS.density
  useLayoutEffect(() => {
    timeline.configure(viewSettings, performance.now())
  }, [timeline, viewSettings.n, viewSettings.l, viewSettings.m, viewSettings.n2, viewSettings.l2, viewSettings.m2, viewSettings.orbitalBasis, viewSettings.superposition, viewSettings.superpositionMix, viewSettings.superpositionPhase, viewSettings.timeEvolution, viewSettings.ensemblePaused, viewSettings.quantumPlayback, viewSettings.coherentTransition, viewSettings.polarization, viewSettings.rabiFrequency, viewSettings.drivePhase, viewSettings.transitionPlaying, viewSettings.transitionLoop, viewSettings.transitionProgress, viewSettings.transitionRun, viewSettings.transitionPlayback])
  // Fiber runs this once before rendering any canvas, so both quantum views
  // consume exactly the same phase even at large energy differences.
  useEffect(() => evolving ? addEffect(now => timeline.tick(now)) : undefined, [timeline, evolving])
  const [statistics] = useState(() => createStatisticsStore(emptyStatistics()))
  const [fps, setFPS] = useState(0)
  const [cloudSize, setCloudSize] = useState<ViewportSize>()
  const [fullScreen, setFullScreen] = useState(false)
  const [simulationRun, setSimulationRun] = useState(0)
  const cameraLink = useMemo<CameraLink>(() => ({ view: { position: [...INITIAL_CAMERA], target: [0, 0, 0] }, events: new EventTarget() }), [simulationRun])
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [transitionAcknowledged, setTransitionAcknowledged] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const guide = useRef<HTMLDialogElement>(null)
  const update: UpdateSettings = useCallback((key, value) => setSettings(previous => ({ ...previous, [key]: value })), [])
  const setState = useCallback(({ n, l, m }: Orbital) => { setSettings(previous => ({ ...previous, n, l, m })) }, [])
  const onStats = useCallback((value: SampleStatistics) => statistics.publish(value), [statistics])
  const onFPS = useCallback((value: number) => setFPS(value), [])
  useKeyboardShortcut(' ', () => update('ensemblePaused', !settings.ensemblePaused), settings.mode !== 'fields')
  useKeyboardShortcut('w', () => {
    const quantities: SurfaceQuantity[] = ['magnitude', 'probability', 'real', 'imaginary']
    update('surfaceQuantity', quantities[(quantities.indexOf(settings.surfaceQuantity) + 1) % quantities.length])
  }, settings.mode !== 'fields')
  const showGuide = () => {
    if (!guide.current) return
    if (guide.current.open) guide.current.close()
    else guide.current.showModal()
    setGuideOpen(guide.current.open)
  }
  const resetSimulation = () => {
    guide.current?.close()
    timeline.configure(defaultSettings, performance.now())
    statistics.publish(emptyStatistics())
    setSettings({ ...defaultSettings })
    // Restart the clocks, samples, cameras, and chart choices together.
    setSimulationRun(run => run + 1)
    setMobileControlsOpen(false)
    setFPS(0)

    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  useEffect(() => {
    const handler = () => setFullScreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="./" aria-label="Hedione's Atomic Orbital Visualizer home" title="Hedione's Atomic Orbital Visualizer"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><b /></span><span className="brand-copy"><span className="brand-title">Hedione's <em>Atomic Orbital Visualizer</em></span><small className="brand-subtitle">HYDROGEN · RADIAL &amp; ANGULAR WAVEFUNCTIONS</small></span></a><div className="header-actions"><span className="local-badge"><i /> LIVE MODEL</span><button className="info-button" type="button" onClick={showGuide} aria-label="About this simulation" title="About this simulation" aria-haspopup="dialog" aria-expanded={guideOpen} aria-controls="simulation-info">i</button><button className="header-reset-button" type="button" onClick={resetSimulation}>RESET SIMULATION</button></div></header>
    <main key={simulationRun}>
      <h1 className="sr-only">Hedione's Atomic Orbital Visualizer</h1>
      <div className="workspace unified-workspace">
        <div className={`sidebar-shell${mobileControlsOpen ? ' is-open' : ''}`}>
          <button className="mobile-controls-toggle" type="button" aria-expanded={mobileControlsOpen} aria-controls="simulation-controls" onClick={() => setMobileControlsOpen(open => !open)}><SlidersHorizontal size={14} /> SIMULATION SETTINGS <ChevronDown size={14} /></button>
          <Controls settings={settings} update={update} setState={setState} timeline={timeline} transitionAcknowledged={transitionAcknowledged} acknowledgeTransition={() => setTransitionAcknowledged(true)} />
        </div>
        {settings.mode === 'fields' ? <FieldShiftModule settings={settings.fieldShift} onChange={value => update('fieldShift', value)} /> : <div className="center-column">
          <section ref={stage} className="stage unified-stage" aria-label="Hydrogen atomic orbital experiment"  data-displayed-n={viewSettings.n} data-displayed-l={viewSettings.l} data-displayed-m={viewSettings.m} data-superposition={viewSettings.superposition} data-evolving={evolving} data-displayed-n2={viewSettings.superposition ? viewSettings.n2 : undefined} data-displayed-l2={viewSettings.superposition ? viewSettings.l2 : undefined} data-displayed-m2={viewSettings.superposition ? viewSettings.m2 : undefined}>
            <div className="stage-topbar"><div><Layers3 size={12} /><span>THE HYDROGEN ATOM</span></div><div className="viewport-tools"><button aria-label="Reset camera" title="Reset all cameras" onClick={() => update('cameraReset', settings.cameraReset + 1)}><RotateCcw size={14} /></button><button aria-label={fullScreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Toggle fullscreen" onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen() } catch { /* Fullscreen is optional in embedded browsers. */ } }}><Expand size={14} /></button></div></div>
            <div className="unified-scenes">
              <ComparisonPanel settings={viewSettings} update={update} onStats={onStats} timeline={timeline} cameraLink={cameraLink} sizeReference={cloudSize} />
              <div className="scene-column ensemble-column">
              <div className="scene-pane ensemble-pane" data-testid="pane-ensemble">
                <div className="pane-label"><Layers3 size={15} /><span>ELECTRON PROBABILITY CLOUD</span></div>
                <div className="pane-canvas"><Scene mode="ensemble" settings={viewSettings} onStats={onStats} onFPS={onFPS} timeline={timeline} cameraLink={cameraLink} onSize={setCloudSize} /></div>
                <p className="pane-note">{settings.ensemblePaused ? 'Sampling paused' : viewSettings.superposition ? 'Independent positions · full coherent |ψ|² d³r' : 'Independent positions · |R(r)Y(θ,φ)|² d³r'}</p>
              </div>
              <EnsembleControls settings={settings} update={update} />
              </div>
              <div className="scene-column wavefunction-column">
              <div className="scene-pane wavefunction-pane" data-testid="pane-wavefunction">
                <div className="pane-label"><Orbit size={14} /><span>WAVEFUNCTION &amp; PROBABILITY</span></div>
                <div className="pane-canvas"><Scene mode="wavefunction" settings={viewSettings} onStats={onStats} timeline={timeline} cameraLink={cameraLink} /></div>
                <div className="pane-phase" data-color-mode={colorMode}>{colorMode === 'phase' ? <><span>{colorLegend}</span><div className="phase-scale"><i style={{ background: colorBackground }} /><div className="phase-ticks">{['−π', '−π/2', '0', '+π/2', '+π'].map((label, index) => <span key={label} style={{ left: `${index * 25}%` }}>{label}</span>)}</div></div></> : <><i style={{ background: colorBackground }} /><span>{colorLegend}</span></>}</div>
              </div>
              <WavefunctionControls settings={settings} update={update} />
              </div>
            </div>
            <div className="stage-bottom"><span className="orbit-hint"><MousePointer2 size={13} /> Drag any view to orbit <i /> Scroll to zoom</span><span className="camera-status">Cameras linked · except Bloch</span><span className="fps-indicator"><i />{!settings.ensemblePaused && fps > 0 ? `${fps} FPS` : 'WEBGL'}<span>GPU accelerated</span></span></div>
          </section>
          <div className="analysis-panel">
            <Diagnostics settings={viewSettings} store={statistics} onFrequencyChange={value => update('histogramFrequency', value)} onReset={() => update('resetStats', settings.resetStats + 1)} />
            <PhysicsPanel settings={viewSettings} timeline={timeline} />
          </div>
        </div>}
      </div>
    </main>
    <dialog ref={guide} id="simulation-info" className="guide-dialog" aria-modal="true" aria-labelledby="simulation-info-title" onClose={() => setGuideOpen(false)} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }} onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) guide.current?.close()
    }}>
      <button className="dialog-close" type="button" autoFocus onClick={() => guide.current?.close()} aria-label="Close information">×</button>
      <div className="eyebrow">ABOUT THE VISUALIZER</div><h2 id="simulation-info-title">A laboratory for hydrogen orbitals</h2>
      <p>Explore a hydrogen electron’s probability cloud and wavefunction by changing its quantum numbers. Compare individual orbitals, coherent superpositions, and ideal atomic transitions to see how quantum states shape probability and phase, or explore energy shifts in electric and magnetic fields.</p>
      <p>Visit the <a href="https://github.com/Hedione/Atomic-Orbital-Visualizer" target="_blank" rel="noopener noreferrer">project on GitHub</a>.</p>
      <section className="guide-shortcuts" aria-labelledby="shortcuts-title">
        <h3 id="shortcuts-title">Keyboard shortcuts</h3>
        <dl>
          <div><dt><kbd>Space</kbd></dt><dd>Pause / resume sampling</dd></div>
          <div><dt><kbd>R</kbd></dt><dd>Randomize quantum numbers</dd></div>
          <div><dt><kbd>W</kbd></dt><dd>Cycle wavefunction, probability density, real, and imaginary views</dd></div>
          <div><dt><kbd>/</kbd></dt><dd>Toggle Field &amp; dipole / Bloch sphere in Transition, or Bohr orbit / Bloch sphere in Superposition</dd></div>
        </dl>
      </section>
    </dialog>
  </div>
}
