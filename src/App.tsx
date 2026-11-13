import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Atom, ChevronDown, ChevronRight, Expand, Layers3, MousePointer2, Orbit, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { Controls, type UpdateSettings } from './components/Controls'
import { LiveDiagnostics as Diagnostics } from './components/Diagnostics'
import { PhysicsPanel } from './components/PhysicsPanel'
import { Scene } from './components/Scene'
import { ClassicalControls, EnsembleControls, WavefunctionControls } from './components/SceneControls'
import { MathText, OrbitalText } from './components/UI'
import { emptyStatistics, type SampleStatistics } from './physics/sampling'

import { createStatisticsStore } from './store/statistics'


import { defaultSettings, surfaceColorMode, type Orbital, type Settings } from './types'
import { QuantumTimeline } from './physics/evolution'
import { addEffect } from '@react-three/fiber'
import { WAVE_COLORS } from './rendering/wave-colors'
import { FieldControls } from './components/FieldControls'

export default function App() {
  const [storedSettings, setSettings] = useState<Settings>(defaultSettings)
  // Fill newly added controls when Vite preserves an older state during refresh.
  const settings: Settings = { ...defaultSettings, ...storedSettings, volumeBrightness: Math.min(10, storedSettings.volumeBrightness ?? defaultSettings.volumeBrightness), surfaceQuantity: ['magnitude', 'probability', 'real', 'imaginary'].includes(storedSettings.surfaceQuantity) ? storedSettings.surfaceQuantity : defaultSettings.surfaceQuantity }

  const viewSettings = settings
  const [timeline] = useState(() => new QuantumTimeline())
  const evolving = viewSettings.coherentTransition || viewSettings.timeEvolution
  const colorMode = surfaceColorMode(viewSettings.surfaceQuantity)
  const colorLegend = colorMode === 'phase' ? 'Complex phase' : colorMode === 'sign' ? 'Sign · positive / negative' : 'Probability density · |ψ|²'
  const signColors = viewSettings.surfaceQuantity === 'real' ? [WAVE_COLORS.realPositive, WAVE_COLORS.realNegative] : [WAVE_COLORS.imaginaryPositive, WAVE_COLORS.imaginaryNegative]
  const colorBackground = colorMode === 'phase' ? `linear-gradient(90deg, ${WAVE_COLORS.realNegative}, ${WAVE_COLORS.imaginaryNegative}, ${WAVE_COLORS.realPositive}, ${WAVE_COLORS.imaginaryPositive}, ${WAVE_COLORS.realNegative})` : colorMode === 'sign' ? `linear-gradient(90deg, ${signColors[0]} 50%, ${signColors[1]} 50%)` : WAVE_COLORS.density
  useLayoutEffect(() => {
    timeline.configure(viewSettings, performance.now())
  }, [timeline, viewSettings.n, viewSettings.l, viewSettings.m, viewSettings.n2, viewSettings.l2, viewSettings.m2, viewSettings.orbitalBasis, viewSettings.superposition, viewSettings.timeEvolution, viewSettings.ensemblePaused, viewSettings.quantumPlayback, viewSettings.coherentTransition, viewSettings.polarization, viewSettings.rabiFrequency, viewSettings.drivePhase, viewSettings.transitionPlaying, viewSettings.transitionLoop, viewSettings.transitionProgress, viewSettings.transitionRun, viewSettings.transitionPlayback])
  // Fiber runs this once before rendering any canvas, so both quantum views
  // consume exactly the same phase even at large energy differences.
  useEffect(() => evolving ? addEffect(now => timeline.tick(now)) : undefined, [timeline, evolving])
  const [statistics] = useState(() => createStatisticsStore(emptyStatistics()))
  const [fps, setFPS] = useState(0)
  const [fullScreen, setFullScreen] = useState(false)
  const [simulationRun, setSimulationRun] = useState(0)
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [transitionAcknowledged, setTransitionAcknowledged] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const guide = useRef<HTMLDialogElement>(null)
  const update: UpdateSettings = useCallback((key, value) => setSettings(previous => ({ ...previous, [key]: value })), [])
  const setState = useCallback(({ n, l, m }: Orbital) => { setSettings(previous => ({ ...previous, n, l, m })) }, [])
  const onStats = useCallback((value: SampleStatistics) => statistics.publish(value), [statistics])
  const onFPS = useCallback((value: number) => setFPS(value), [])
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
        <div className="center-column">
          <section ref={stage} className="stage unified-stage" aria-label="Hydrogen atomic orbital experiment"  data-displayed-n={viewSettings.n} data-displayed-l={viewSettings.l} data-displayed-m={viewSettings.m} data-superposition={viewSettings.superposition} data-evolving={evolving} data-displayed-n2={viewSettings.superposition ? viewSettings.n2 : undefined} data-displayed-l2={viewSettings.superposition ? viewSettings.l2 : undefined} data-displayed-m2={viewSettings.superposition ? viewSettings.m2 : undefined}>
            <div className="stage-topbar"><div><Layers3 size={12} /><span>THE HYDROGEN ATOM</span></div><div className="viewport-tools"><button aria-label="Reset camera" title="Reset all cameras" onClick={() => update('cameraReset', settings.cameraReset + 1)}><RotateCcw size={14} /></button><button aria-label={fullScreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Toggle fullscreen" onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current?.requestFullscreen() } catch { /* Fullscreen is optional in embedded browsers. */ } }}><Expand size={14} /></button></div></div>
            <div className="unified-scenes">
              <div className="scene-column classical-column">
              <div className="scene-pane classical-pane" data-testid="pane-classical">
                <div className="pane-label"><Atom size={14} /><span>{viewSettings.coherentTransition ? 'ELECTRIC FIELD & DIPOLE' : viewSettings.superposition ? 'BOHR ORBITS' : 'BOHR ORBIT'}</span></div>
                <div className="pane-canvas"><Scene mode={viewSettings.coherentTransition ? 'field' : 'classical'} settings={viewSettings} onStats={onStats} id="classical" timeline={timeline} /></div>
                <p className="pane-note">{viewSettings.coherentTransition ? <span className="field-legend"><span className="field-electric">E/E₀</span><span className="field-dipole">⟨μ⟩/μ₀</span></span> : viewSettings.superposition ? <span className="component-legend"><i />State 1 <b />State 2</span> : 'Historical comparison · r = n²a₀'}</p>
              </div>
              {viewSettings.coherentTransition ? <FieldControls settings={viewSettings} timeline={timeline} /> : <ClassicalControls settings={settings} update={update} />}
              </div>
              <div className="scene-column ensemble-column">
              <div className="scene-pane ensemble-pane" data-testid="pane-ensemble">
                <div className="pane-label"><Layers3 size={15} /><span>ELECTRON PROBABILITY CLOUD</span></div>
                <div className="pane-canvas"><Scene mode="ensemble" settings={viewSettings} onStats={onStats} id="ensemble" onFPS={onFPS} timeline={timeline} /></div>
                <p className="pane-note">{settings.ensemblePaused ? 'Sampling paused' : viewSettings.superposition ? 'Independent positions · full coherent |ψ|² d³r' : 'Independent positions · |R(r)Y(θ,φ)|² d³r'}</p>
              </div>
              <EnsembleControls settings={settings} update={update} />
              </div>
              <div className="scene-column wavefunction-column">
              <div className="scene-pane wavefunction-pane" data-testid="pane-wavefunction">
                <div className="pane-label"><Orbit size={14} /><span>WAVEFUNCTION &amp; PROBABILITY</span></div>
                <div className="pane-canvas"><Scene mode="wavefunction" settings={viewSettings} onStats={onStats} id="wavefunction" timeline={timeline} /></div>
                <div className="pane-phase" data-color-mode={colorMode}>{colorMode === 'phase' ? <><span>{colorLegend}</span><div className="phase-scale"><i style={{ background: colorBackground }} /><div className="phase-ticks">{['−π', '−π/2', '0', '+π/2', '+π'].map((label, index) => <span key={label} style={{ left: `${index * 25}%` }}>{label}</span>)}</div></div></> : <><i style={{ background: colorBackground }} /><span>{colorLegend}</span></>}</div>
              </div>
              <WavefunctionControls settings={settings} update={update} />
              </div>
            </div>
            <div className="stage-bottom"><span className="orbit-hint"><MousePointer2 size={13} /> Drag any view to orbit <i /> Scroll to zoom</span><span className="camera-status">Cameras synchronized</span><span className="fps-indicator"><i />{fps > 0 ? `${fps} FPS` : 'WEBGL'}<span>GPU accelerated</span></span></div>
          </section>
          <div className="analysis-panel">
            <Diagnostics settings={viewSettings} store={statistics} onFrequencyChange={value => update('histogramFrequency', value)} onReset={() => update('resetStats', settings.resetStats + 1)} />
            <PhysicsPanel settings={viewSettings} timeline={timeline} />
          </div>
        </div>
      </div>
    </main>
    <dialog ref={guide} id="simulation-info" className="guide-dialog" aria-modal="true" aria-labelledby="simulation-info-title" onClose={() => setGuideOpen(false)} onClick={e => { if (e.target === e.currentTarget) guide.current?.close() }}>
      <button className="dialog-close icon-button" autoFocus onClick={() => guide.current?.close()} aria-label="Close information"><X size={18} /></button>
      <div className="eyebrow">ABOUT THE MODEL</div><h2 id="simulation-info-title">A laboratory for hydrogen orbitals</h2>
      <p>Explore the spatial wavefunctions of one electron bound to a proton. Each orbital combines a radial function with a complex spherical harmonic.</p>
      <MathText block>{String.raw`\psi_{n\ell m}(r,\theta,\phi)=R_{n\ell}(r)Y_\ell^m(\theta,\phi),\qquad E_n=-\frac{13.6057}{n^2}\;\mathrm{eV}`}</MathText>
      <div className="guide-grid">
        <section><h3>Bohr comparison</h3><p>Historical circular orbits have radius n²a₀ and depend only on n. They are a comparison with the quantum model. They do not describe the trajectories of sampled electrons.</p></section>
        <section><h3>Electron probability cloud</h3><p>Each point is an independent possible position of the same electron, sampled from |ψ|² d³r = |ψ|² r² sin θ dr dθ dφ. Superpositions include coherent interference in all three coordinates.</p></section>
        <section><h3>Wavefunction &amp; probability</h3><p>The volume shows the full radial and angular wavefunction, including radial nodes. Choose phase, probability density, or real/imaginary views and adjust volume brightness. Real orbital combinations provide <OrbitalText>p_x</OrbitalText>, <OrbitalText>p_y</OrbitalText>, <OrbitalText>p_z</OrbitalText> and higher real harmonics. These remain energy eigenstates but generally combine different Lz values. Phase color can evolve while an eigenstate's probability stays fixed.</p></section>
        <section><h3>Atomic transitions</h3><p>An ideal resonant two-state pulse obeys Δℓ = ±1 and Δmℓ = 0, ±1. Δn is unrestricted, with a nonzero energy gap for a resonant photon. The transition dipole includes the radial overlap. The first example is 1s → 2p, mℓ = 0.</p></section>
      </div>
      <p className="guide-callout">This is a nonrelativistic Coulomb model with an infinitely massive proton. Electron spin, fine structure, the Lamb shift, and spontaneous emission are omitted. States with the same n are degenerate.</p>
      <p className="guide-small">a₀ = 52.9177 pm. Normal mode covers n = 1–6; Explore high n extends to 20. Cloud and volume scales fit 99.9% of the basis radial probabilities; the distributions retain the radial tails. Quantum playback starts at 1 fs per display second. Scale bars show physical distances in the plane through each view center. Drag to orbit; scroll to zoom. RESET SIMULATION resets states, clocks, cameras, and samples.</p>
      <p className="guide-small">Physics references: <a href="https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2007/c2078ff25c61c136e67ceb6fd8eb9b34_lecture21to22.pdf" target="_blank" rel="noreferrer">MIT hydrogen-atom notes</a> · <a href="https://physics.nist.gov/Pubs/AtSpec/node17.html" target="_blank" rel="noreferrer">NIST selection rules</a>.</p>
      <button className="primary-button" onClick={() => guide.current?.close()}>Back to the experiment <ChevronRight size={15} /></button>
    </dialog>
  </div>
}
