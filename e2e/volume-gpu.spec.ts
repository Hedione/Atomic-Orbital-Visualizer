import { test, expect } from '@playwright/test'
import { buildSync } from 'esbuild'
import type { Settings } from '../src/types'
import type { WaveCoefficients } from '../src/physics/superposition'

test('optimized volume preserves complex fields, nodes, phase colors, opacity, and camera views', async ({ page }) => {
  test.setTimeout(240000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const bundle = buildSync({ entryPoints: ['e2e/fixtures/volume-gpu.ts'], bundle: true, format: 'iife', write: false }).outputFiles[0].text
  await page.route('**/volume-gpu.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }))
  await page.goto('/volume-gpu.html')
  await page.addScriptTag({ content: bundle })
  const states: Partial<Settings>[] = [
    { n: 1, l: 0, m: 0 }, {}, { m: 1, orbitalBasis: 'real' },
    { n: 4, l: 0, m: 0 }, { n: 4, l: 3, m: -2, orbitalBasis: 'complex' }, { n: 20, l: 19, m: -19, orbitalBasis: 'complex' },
    { m: 1, m2: -1, superposition: true, orbitalBasis: 'complex' },
    { n: 3, l: 0, m: 0, n2: 4, l2: 0, m2: 0, superposition: true },
  ]
  const phases: WaveCoefficients[] = [
    { first: { re: Math.SQRT1_2, im: 0 }, second: { re: Math.SQRT1_2, im: 0 } },
    { first: { re: 0, im: Math.SQRT1_2 }, second: { re: Math.SQRT1_2, im: 0 } },
    { first: { re: Math.SQRT1_2, im: 0 }, second: { re: -Math.SQRT1_2, im: 0 } },
  ]
  for (const state of states) {
    const field = await page.evaluate(state => window.volumeGPU.fieldComparison(state), state)
    expect(field.glError).toBe(0)
    expect(field.packedRelativeError).toBeLessThan(0.000001)
    expect(field.relativeToPeak).toBeLessThan(0.001)
    expect(field.afterAnalyticError).toBeLessThanOrEqual(field.beforeAnalyticError + 0.00001)
    for (const surfaceQuantity of ['magnitude', 'probability', 'real', 'imaginary'] as const) {
      const comparison = await page.evaluate(state => window.volumeGPU.compare(state), { ...state, surfaceQuantity })
      expect(comparison.glError).toBe(0)
      expect(comparison.max, JSON.stringify({ state, surfaceQuantity, comparison })).toBeLessThanOrEqual(2)
      expect(comparison.changedPixels).toBe(0)
    }
  }
  for (const volumeBrightness of [0.1, 5, 10]) for (const angle of [0, 0.7, 1.6, Math.PI - 0.001, Math.PI + 0.001]) {
    const comparison = await page.evaluate(({ volumeBrightness, angle }) => window.volumeGPU.compare({ volumeBrightness, orbitalBasis: 'real', m: 1 }, undefined, angle), { volumeBrightness, angle })
    expect(comparison.max, JSON.stringify({ volumeBrightness, angle, comparison })).toBeLessThanOrEqual(2)
  }
  for (const coefficients of phases) for (const angle of [0, 0.9]) {
    const state = { n: 3, l: 0, m: 0, n2: 4, l2: 0, m2: 0, superposition: true }
    const comparison = await page.evaluate(({ state, coefficients, angle }) => window.volumeGPU.compare(state, coefficients, angle), { state, coefficients, angle })
    expect(comparison.max, JSON.stringify({ coefficients, angle, comparison })).toBeLessThanOrEqual(2)
    const field = await page.evaluate(({ state, coefficients }) => window.volumeGPU.fieldComparison(state, coefficients), { state, coefficients })
    expect(field.relativeToPeak).toBeLessThan(0.001)
    expect(field.afterAnalyticError).toBeLessThanOrEqual(field.beforeAnalyticError + 0.00001)
  }
  const fallback = await page.evaluate(() => window.volumeGPU.compare({ n: 20, l: 19, m: 19 }, undefined, 0.4, true))
  expect(fallback.max).toBeLessThanOrEqual(2)
  expect(errors).toEqual([])
})
