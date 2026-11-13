import { useId, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Settings } from '../types'
import { getElectronColor, hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, type HSV } from '../rendering/colors'
import type { UpdateSettings } from './Controls'
import { NumberInput } from './UI'

export function CustomElectronColor({ settings, update }: { settings: Settings; update: UpdateSettings }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const initialized = useRef(settings.electronPalette === 'custom')
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(settings.customElectronColor)))
  const id = useId()
  const rgb = hexToRgb(settings.customElectronColor)
  const apply = (next: HSV) => {
    setHsv(next)
    update('customElectronColor', rgbToHex(hsvToRgb(next)))
  }
  const show = () => {
    const color = initialized.current ? settings.customElectronColor : getElectronColor(settings)
    initialized.current = true
    update('customElectronColor', color)
    setHsv(rgbToHsv(hexToRgb(color)))
    update('electronPalette', 'custom')
    const element = dialog.current!
    const anchor = trigger.current!.getBoundingClientRect()
    element.showModal()
    const bounds = element.getBoundingClientRect()
    element.style.left = `clamp(12px, ${anchor.right - bounds.width}px, calc(100vw - ${bounds.width + 12}px))`
    element.style.top = `clamp(12px, ${anchor.top - bounds.height - 8}px, calc(100dvh - ${bounds.height + 12}px))`
    setOpen(true)
  }
  const moveWheel = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2)
    const y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2)
    apply({ ...hsv, h: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(x, y)) })
  }
  return <>
    <button ref={trigger} type="button" aria-label="Custom electron color" title="Custom electron color" aria-pressed={settings.electronPalette === 'custom'} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} onClick={show}>
      <i style={{ background: settings.customElectronColor }} /><span>Custom</span>
    </button>
    {createPortal(<dialog ref={dialog} id={id} className="electron-color-dialog" aria-labelledby={`${id}-title`} onClose={() => setOpen(false)} onClick={event => {
      if (event.target === event.currentTarget) {
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close()
      }
    }}>
      <div className="color-dialog-heading"><h3 id={`${id}-title`}>Custom electron color</h3><button type="button" className="icon-button" aria-label="Close custom color" onClick={() => dialog.current?.close()}><X size={16} /></button></div>
      <div className="electron-color-wheel" role="slider" tabIndex={0} aria-label="Color wheel" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)} aria-valuetext={`Hue ${Math.round(hsv.h)} degrees, saturation ${Math.round(hsv.s * 100)} percent`} aria-describedby={`${id}-help`}
        onPointerDown={event => { event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); moveWheel(event) }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveWheel(event) }}
        onKeyDown={event => {
          const step = event.shiftKey ? 10 : 1
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault()
            apply({ ...hsv, h: (hsv.h + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0) + 360) % 360, s: Math.max(0, Math.min(1, hsv.s + (event.key === 'ArrowUp' ? step / 100 : event.key === 'ArrowDown' ? -step / 100 : 0))) })
          }
        }}>
        <span className="wheel-shade" style={{ opacity: 1 - hsv.v }} />
        <span className="wheel-cursor" style={{ left: `${50 + Math.cos(hsv.h * Math.PI / 180) * hsv.s * 50}%`, top: `${50 + Math.sin(hsv.h * Math.PI / 180) * hsv.s * 50}%`, background: settings.customElectronColor }} />
      </div>
      <p id={`${id}-help`} className="sr-only">Left and right change hue. Up and down change saturation. Hold Shift for larger steps.</p>
      <label className="color-brightness">Brightness <output>{Math.round(hsv.v * 100)}%</output><input type="range" aria-label="Color brightness" min={0} max={100} value={Math.round(hsv.v * 100)} onChange={event => apply({ ...hsv, v: Number(event.target.value) / 100 })} /></label>
      <div className="color-rgb-fields">{([['r', 'Red'], ['g', 'Green'], ['b', 'Blue']] as const).map(([channel, label]) => <label key={channel}>{label}<NumberInput ariaLabel={label} min={0} max={255} step={1} value={rgb[channel]} onCommit={value => {
        const next = { ...rgb, [channel]: Math.round(Math.max(0, Math.min(255, value))) }
        update('customElectronColor', rgbToHex(next)); setHsv(rgbToHsv(next))
        return next[channel]
      }} /></label>)}</div>
      <div className="color-preview"><i style={{ background: settings.customElectronColor }} /><output aria-label="Selected color">{settings.customElectronColor.toUpperCase()}</output></div>
    </dialog>, document.body)}
  </>
}
