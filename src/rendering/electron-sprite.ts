import { CanvasTexture } from 'three'

// Discard only near-zero sprite coverage; multiply by material opacity at use sites.
export const ELECTRON_ALPHA_TEST = 1 / 255

/** Bake soft edges once; rendering keeps the existing texture lookup and point draw. */
export function createElectronSprite() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32
  const context = canvas.getContext('2d')!
  const edge = context.createRadialGradient(16, 16, 10, 16, 16, 14)
  edge.addColorStop(0, 'rgba(255,255,255,1)')
  edge.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = edge
  context.fillRect(0, 0, 32, 32)
  return new CanvasTexture(canvas)
}
