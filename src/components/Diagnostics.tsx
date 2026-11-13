import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ChartNoAxesColumn, RotateCcw } from 'lucide-react'
import type { SampleStatistics } from '../physics/sampling'
import { prepareDistribution, marginalAtMoments } from '../physics/distributions'
import { HISTOGRAM_BINS, HISTOGRAM_BIN_OPTIONS, DIAGNOSTICS_HZ, rebinCounts, rebinDensities } from '../physics/histograms'
import { pairedState, radialQuantile, radialTable } from '../physics/hydrogen'
import type { StatisticsStore } from '../store/statistics'
import { Range } from './UI'
import { defaultSettings, type Settings } from '../types'
function DistributionChart({ title, description, theory, bins, domain, ticks, axis, formula, className }: {
  title: string; description: string; theory: number[]; bins: number[]; domain: [number, number];
  ticks: { value: number; label: string }[]; axis: string; formula: string; className: string;
}) {
  const chart = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 440, height: 200 })
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    })
    if (chart.current) observer.observe(chart.current)
    return () => observer.disconnect()
  }, [])
  const total = bins.reduce((a, b) => a + b, 0)
  const densities = bins.map(n => total > 0 ? n / total / ((domain[1] - domain[0]) / bins.length) : 0)
  const maxY = Math.max(...theory, ...densities) * 1.2
  const W = size.width, H = size.height, left = 48, right = 16, top = 10, bottom = 36
  const width = W - left - right, height = H - top - bottom
  const barWidth = width / bins.length, barGap = 0
  const line = theory.map((p, i) => `${i ? 'L' : 'M'}${(left + i / (theory.length - 1) * width).toFixed(2)},${(top + height - p / maxY * height).toFixed(2)}`).join(' ')
  return <div className={`distribution-chart ${className}`}>
    <h3>{title}</h3>
    <svg ref={chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} data-bin-count={bins.length} data-theory-min={Math.min(...theory)} data-theory-max={Math.max(...theory)}>
      {[0, 0.5, 1].map(t => <g key={t}><line className="chart-grid" x1={left} x2={W - right} y1={top + height * t} y2={top + height * t} /><text x={left - 7} y={top + height * t + 3} textAnchor="end">{(maxY * (1 - t)).toFixed(2)}</text></g>)}
      {densities.map((d, i) => <rect className="chart-sample" key={i} x={left + i * barWidth + barGap / 2} y={top + height - d / maxY * height} width={barWidth - barGap} height={d / maxY * height} />)}
      <path className="chart-theory" d={line} fill="none" />
      {ticks.map(tick => <text key={tick.value} x={left + (tick.value - domain[0]) / (domain[1] - domain[0]) * width} y={H - 20} textAnchor="middle">{tick.label}</text>)}
      <text x={left + width / 2} y={H - 4} textAnchor="middle">{axis}</text>
    </svg>
    <p>{formula}</p>
  </div>
}


const stepCurve = (values: number[]) => Array.from({ length: values.length * 2 }, (_, i) => values[Math.floor(i / 2)])
export function LiveDiagnostics({ store, settings, onReset, onFrequencyChange }: { store: StatisticsStore; settings: Settings; onReset: () => void; onFrequencyChange: (value: number) => void }) {
  const stats = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return <Diagnostics settings={settings} stats={stats} onReset={onReset} onFrequencyChange={onFrequencyChange} />
}
export function Diagnostics({ settings: s, stats, onReset, onFrequencyChange }: { settings: Settings; stats: SampleStatistics; onReset: () => void; onFrequencyChange: (value: number) => void }) {
  const [cumulative, setCumulative] = useState(false), [binCount, setBinCount] = useState(HISTOGRAM_BINS), [solidAngle, setSolidAngle] = useState(false)
  const radius = Math.max(radialQuantile(radialTable(s.n, s.l), 0.99999), pairedState(s) ? radialQuantile(radialTable(s.n2, s.l2), 0.99999) : 0)
  const basis = useMemo(() => prepareDistribution(s, radius), [s.n, s.l, s.m, s.n2, s.l2, s.m2, s.orbitalBasis, s.superposition, s.coherentTransition, radius])
  const moments = cumulative ? stats.meanMoments : stats.moments
  const theory = (axis: 'polar' | 'theta' | 'radial' | 'azimuth') => stepCurve(rebinDensities(marginalAtMoments(basis[axis], moments), binCount))
  const histogram = (total: number[], current: number[]) => rebinCounts(cumulative ? total : current, binCount)
  return <section className="diagnostics" aria-label="Position distribution diagnostics" data-update-hz={s.histogramFrequency}>
    <div className="diagnostics-heading"><div><ChartNoAxesColumn size={15} /><span>POSITION DISTRIBUTIONS</span></div><div className="chart-legend"><span><i className="theory-line" /> Theory (bin average)</span><span><i className="sample-block" /> Samples</span></div></div>
    <div className="distribution-charts hydrogen-charts">
      <DistributionChart className="radial-chart" title="RADIAL" description="Radial electron probability: theory and sampled histogram" theory={theory('radial')} bins={histogram(stats.radialHistogram, stats.currentRadialHistogram)} domain={[0, radius]} ticks={[0, 0.5, 1].map(t => ({ value: t * radius, label: (t * radius).toFixed(1) }))} axis="r / a₀" formula="p(r) = r² ∫ |ψ(r,θ,φ)|² dΩ · includes radial nodes" />
      <div className="polar-distribution-controls"><div className="distribution-view-control" role="group" aria-label="Polar probability view"><button className={solidAngle ? 'chip' : 'chip active'} aria-pressed={!solidAngle} onClick={() => setSolidAngle(false)}>Density vs cos θ</button><button className={solidAngle ? 'chip active' : 'chip'} aria-pressed={solidAngle} onClick={() => setSolidAngle(true)}>Solid-angle probability</button></div></div>
      {solidAngle ? <DistributionChart className="polar-chart" title="POLAR · SOLID ANGLE INCLUDED" description="Solid-angle integrated polar electron probability per theta" theory={theory('theta')} bins={histogram(stats.thetaHistogram, stats.currentThetaHistogram)} domain={[0, Math.PI]} ticks={[{ value: 0, label: '0' }, { value: Math.PI / 2, label: 'π/2' }, { value: Math.PI, label: 'π' }]} axis="θ (rad)" formula="p(θ) = sin θ ∫ r² |ψ(r,θ,φ)|² dr dφ" /> : <DistributionChart className="polar-chart" title="POLAR" description="Polar electron probability density of cos theta: theory and sampled histogram" theory={theory('polar')} bins={histogram(stats.histogram, stats.currentHistogram)} domain={[-1, 1]} ticks={[-1, 0, 1].map(u => ({ value: u, label: String(u) }))} axis="cos θ" formula="p(u) = ∫ r² |ψ(r,acos u,φ)|² dr dφ" />}
      <DistributionChart className="azimuthal-chart" title="AZIMUTHAL" description="Azimuthal electron probability: theory and sampled histogram" theory={theory('azimuth')} bins={histogram(stats.azimuthHistogram, stats.currentAzimuthHistogram)} domain={[0, 2 * Math.PI]} ticks={[{ value: 0, label: '0' }, { value: Math.PI, label: 'π' }, { value: 2 * Math.PI, label: '2π' }]} axis="φ (rad)" formula="p(φ) = ∫ r² |ψ(r,θ,φ)|² sin θ dr dθ" />
    </div>
    <div className="diagnostics-footer">
      <div className="diagnostics-footer-range histogram-bin-control"><Range label="Histogram bins" value={binCount} resetValue={HISTOGRAM_BINS} min={10} max={320} options={HISTOGRAM_BIN_OPTIONS} display={`${binCount} bins`} onChange={setBinCount} /></div>
      <div className="diagnostics-footer-actions"><button className={cumulative ? 'chip active' : 'chip'} aria-pressed={cumulative} onClick={() => setCumulative(!cumulative)}>{cumulative ? 'Cumulative' : 'Current batch'}</button><button className="icon-button" aria-label="Reset cumulative statistics" title="Reset cumulative statistics" onClick={onReset}><RotateCcw size={17} /></button></div>
      <div className="diagnostics-footer-range histogram-rate-control"><Range label="Histogram sampling rate" value={s.histogramFrequency} resetValue={defaultSettings.histogramFrequency} min={1} max={DIAGNOSTICS_HZ} suffix="Hz" onChange={onFrequencyChange} /></div>
      <span className="diagnostics-sample-summary"><strong data-testid="cumulative-samples">{stats.total.toLocaleString()}</strong> cumulative samples</span>
    </div>
  </section>
}
