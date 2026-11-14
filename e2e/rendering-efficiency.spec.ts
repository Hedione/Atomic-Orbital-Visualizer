import { expect, test } from '@playwright/test'
import { selectMode } from './modes'

test('paused views stop rendering and wake for samples, uniforms, cameras, and pulse edits', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const clear = WebGL2RenderingContext.prototype.clear
    WebGL2RenderingContext.prototype.clear = function (mask) {
      if (this.canvas instanceof HTMLCanvasElement) this.canvas.dataset.auditClears = String(Number(this.canvas.dataset.auditClears ?? 0) + 1)
      clear.call(this, mask)
    }
  })
  await page.goto('/')
  const cloud = page.getByTestId('scene-ensemble').locator('canvas'), volume = page.getByTestId('scene-wavefunction').locator('canvas')
  const counts = () => Promise.all([cloud, volume].map(canvas => canvas.evaluate(element => Number(element.dataset.auditClears ?? 0))))
  const total = async () => Number((await page.getByTestId('cumulative-samples').textContent())!.replaceAll(',', ''))
  await expect.poll(total, { timeout: 15000 }).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  const idle = async () => {
    await page.waitForTimeout(1200)
    const before = await counts()
    await page.waitForTimeout(500)
    expect(await counts()).toEqual(before)
  }
  await idle()
  const paused = await counts(), pausedSamples = await total()
  await page.getByRole('button', { name: 'Regenerate once', exact: true }).click()
  await expect.poll(async () => (await counts())[0]).toBeGreaterThan(paused[0])
  await expect.poll(total).toBeGreaterThan(pausedSamples)
  await idle()
  const beforeBrightness = await counts()
  await page.getByRole('slider', { name: 'Volume brightness', exact: true }).fill('7000')
  await expect.poll(async () => (await counts())[1]).toBeGreaterThan(beforeBrightness[1])
  await idle()
  const beforeCamera = await counts()
  await cloud.hover(); await page.mouse.wheel(0, -100)
  await expect.poll(async () => (await counts()).every((count, i) => count > beforeCamera[i])).toBe(true)
  await idle()
  await page.getByRole('button', { name: 'Resume sampling', exact: true }).click()
  const resumed = await counts()
  await expect.poll(async () => (await counts()).every((count, i) => count > resumed[i])).toBe(true)
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  await selectMode(page, 'Transition mode')
  await page.getByRole('button', { name: 'I understand', exact: true }).click()
  await page.getByRole('tab', { name: 'Bloch sphere', exact: true }).click()
  const allCounts = () => page.locator('canvas').evaluateAll(elements => elements.map(element => Number(element.dataset.auditClears ?? 0)))
  await page.waitForTimeout(1200)
  const beforeScrub = await allCounts()
  await page.waitForTimeout(500)
  expect(await allCounts()).toEqual(beforeScrub)
  await page.getByRole('slider', { name: 'π-pulse progress', exact: true }).fill('50')
  await expect.poll(async () => (await allCounts()).every((count, i) => count > beforeScrub[i])).toBe(true)
  await expect.poll(async () => Number(await page.getByTestId('bloch-readouts').getAttribute('data-z'))).toBeCloseTo(0, 12)
  await idle()
  expect(errors).toEqual([])
})
