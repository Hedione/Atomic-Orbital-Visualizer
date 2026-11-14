import { Pause, Play, Shuffle } from 'lucide-react'
import { defaultSettings, type Settings, type SurfaceQuantity } from '../types'
import { MAX_ELECTRONS } from '../physics/sampling'
import type { UpdateSettings } from './Controls'
import { Range } from './UI'
import { ELECTRON_PALETTES } from '../rendering/colors'
import { CustomElectronColor } from './CustomElectronColor'
type Props = { settings: Settings; update: UpdateSettings }
export function EnsembleControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls ensemble-controls" aria-label="Probability ensemble controls" data-testid="controls-ensemble">
    <div className="scene-controls-heading ensemble-controls-heading"><h3>Electron probability cloud</h3><div className="button-pair"><button className="action-button" onClick={() => update('ensemblePaused', !s.ensemblePaused)}>{s.ensemblePaused ? <Play size={13} /> : <Pause size={13} />}{s.ensemblePaused ? 'Resume sampling' : 'Pause sampling'}</button><button className="icon-button" title="Regenerate once" aria-label="Regenerate once" onClick={() => update('regenerate', s.regenerate + 1)}><Shuffle size={15} /></button></div></div>
    <div className="scene-controls-body">
      <Range label="Number of samples" compactLabel="Samples" value={s.count} resetValue={defaultSettings.count} min={1} max={MAX_ELECTRONS} onChange={v => update('count', v)} logarithmic />
      <Range label="Electron opacity" compactLabel="Opacity" value={s.electronOpacity} resetValue={defaultSettings.electronOpacity} min={0.01} max={1} step={0.01} display={`${Math.round(s.electronOpacity * 100)}%`} logarithmic onChange={v => update('electronOpacity', v)} />
      <Range label="Sampling rate" value={s.frequency} resetValue={defaultSettings.frequency} min={1} max={60} suffix="Hz" onChange={v => update('frequency', v)} />
      <Range label="Visual density" value={s.visualDensity} resetValue={defaultSettings.visualDensity} min={0.25} max={1.5} step={0.05} display={`${Number(s.visualDensity.toFixed(2))}×`} onChange={value => update('visualDensity', value)} />
      <div className="ensemble-footer-controls"><div className="electron-palette" role="group" aria-label="Electron color">{Object.entries(ELECTRON_PALETTES).map(([key, palette]) => <button key={key} type="button" aria-label={palette.label} title={palette.label} aria-pressed={s.electronPalette === key} onClick={() => update('electronPalette', key as Settings['electronPalette'])}><i style={{ background: palette.color }} /><span>{palette.label}</span></button>)}<CustomElectronColor settings={s} update={update} /></div></div>
    </div>
  </section>
}
export function ClassicalControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls" aria-label="Bohr orbit controls" data-testid="controls-classical">
    <h3 className="scene-controls-heading">Bohr comparison</h3><div className="scene-controls-body">
      <Range label="Bohr playback speed" value={s.playback} resetValue={1} min={0.01} max={100} step={0.01} display={`${Number(s.playback.toFixed(2))}×`} logarithmic onChange={v => update('playback', v)} />
    </div>
  </section>
}
export function WavefunctionControls({ settings: s, update }: Props) {
  return <section className="inline-scene-controls" aria-label="Wavefunction and probability controls" data-testid="controls-wavefunction">
    <h3 className="scene-controls-heading">Wavefunction &amp; probability</h3><div className="scene-controls-body">
      <div className="radial-quantity"><span>Volume quantity</span><div className="radial-buttons" role="group" aria-label="Wavefunction quantity">{([
        ['magnitude', 'Wavefunction', 'ψ = RY'], ['probability', 'Probability density', '|ψ|²'],
        ['real', 'Real component', 'Re(ψ)'], ['imaginary', 'Imaginary component', 'Im(ψ)'],
      ] as [SurfaceQuantity, string, string][]).map(([quantity, label, formula]) => <button key={quantity} type="button" aria-label={label} title={quantity === 'magnitude' ? 'Opacity shows |ψ|; color shows complex phase. The volume includes the radial function and its nodes.' : undefined} aria-pressed={s.surfaceQuantity === quantity} onClick={() => update('surfaceQuantity', quantity)}><span>{label}</span><small>{formula}</small></button>)}</div></div>
      <Range label="Volume brightness" value={s.volumeBrightness} resetValue={1} min={0.1} max={10} step={0.1} minLabel="0.1×" maxLabel="10×" logarithmic display={`${s.volumeBrightness.toFixed(1)}×`} onChange={value => update('volumeBrightness', value)} />
    </div>
  </section>
}
