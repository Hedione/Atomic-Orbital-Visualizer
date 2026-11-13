import { expect, test } from '@playwright/test'

test('electron presets and custom RGB colors recolor paused samples and reset to mint', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await expect.poll(async () => Number((await page.getByTestId('cumulative-samples').textContent())?.replaceAll(',', '')), { timeout: 15000 }).toBeGreaterThan(0)
  const opacity = page.getByRole('slider', { name: 'Electron opacity', exact: true })
  await opacity.fill('0')
  await expect(opacity).toHaveAttribute('aria-valuenow', '0.01')
  const faintTotal = Number((await page.getByTestId('cumulative-samples').innerText()).replaceAll(',', ''))
  await expect.poll(async () => Number((await page.getByTestId('cumulative-samples').innerText()).replaceAll(',', ''))).toBeGreaterThan(faintTotal)
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  // Regenerate records immediately, draining any batch pending when sampling paused.
  const pausedTotal = Number((await page.getByTestId('cumulative-samples').innerText()).replaceAll(',', ''))
  await page.getByRole('button', { name: 'Regenerate once', exact: true }).click()
  await expect.poll(async () => Number((await page.getByTestId('cumulative-samples').innerText()).replaceAll(',', ''))).toBeGreaterThan(pausedTotal)
  const palettes = page.getByRole('group', { name: 'Electron color', exact: true })
  const view = page.getByTestId('scene-ensemble')
  const snapshot = async () => {
    const bounds = (await view.boundingBox())!, png = (await page.screenshot()).toString('base64')
    // Crop the composed page: clipped WebGL captures can reuse an old compositor frame.
    const data = await page.evaluate(async ({ bounds, png }) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob())
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bounds.width); canvas.height = Math.round(bounds.height)
      const context = canvas.getContext('2d')!; context.drawImage(image, -bounds.x, -bounds.y); image.close()
      return canvas.toDataURL().split(',')[1]
    }, { bounds, png })
    return Buffer.from(data, 'base64')
  }
  // Statistics publish before the new point buffer reaches the composed WebGL frame.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const mint = await snapshot()
  const total = await page.getByTestId('cumulative-samples').innerText()
  for (const name of ['Rose', 'Lilac', 'Gold', 'Azure']) {
    const button = palettes.getByRole('button', { name, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  }
  await expect.poll(async () => !(await snapshot()).equals(mint), { timeout: 15000 }).toBe(true)

  const custom = palettes.getByRole('button', { name: 'Custom electron color', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Custom electron color', exact: true })
  await custom.click()
  await expect(custom).toHaveAttribute('aria-pressed', 'true')
  await expect(custom).toHaveAttribute('aria-expanded', 'true')
  await expect(dialog.getByLabel('Selected color', { exact: true })).toHaveText('#2684E8')
  for (const [channel, value] of [['Red', '255'], ['Green', '0'], ['Blue', '0']]) {
    await dialog.getByRole('spinbutton', { name: channel, exact: true }).fill(value)
  }
  await expect(dialog.getByLabel('Selected color', { exact: true })).toHaveText('#FF0000')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(custom).toBeFocused()
  await expect(custom).toHaveAttribute('aria-expanded', 'false')
  const red = await snapshot()
  expect(red.equals(mint)).toBe(false)
  await palettes.getByRole('button', { name: 'Mint', exact: true }).click()
  await expect.poll(async () => (await snapshot()).equals(mint), { timeout: 15000 }).toBe(true)
  await custom.click()
  await expect(dialog.getByLabel('Selected color', { exact: true })).toHaveText('#FF0000')

  const wheel = dialog.getByRole('slider', { name: 'Color wheel', exact: true })
  await wheel.focus(); await wheel.press('Shift+ArrowRight')
  await expect(wheel).toHaveAttribute('aria-valuenow', '10')
  await wheel.click({ position: { x: 87, y: 173 } })
  await expect(wheel).toHaveAttribute('aria-valuenow', '90')
  const brightness = dialog.getByRole('slider', { name: 'Color brightness', exact: true })
  await brightness.fill('0')
  await expect(dialog.getByLabel('Selected color', { exact: true })).toHaveText('#000000')
  await brightness.fill('100')
  await expect(dialog.getByLabel('Selected color', { exact: true })).not.toHaveText('#000000')
  await dialog.getByRole('button', { name: 'Close custom color', exact: true }).click()

  for (const width of [1440, 1101, 1100, 720, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await custom.click()
    const bounds = (await dialog.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(900)
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    if (width === 320) await dialog.screenshot({ path: 'test-results/custom-electron-color-mobile.png' })
    await page.mouse.click(2, 2)
    await expect(dialog).toBeHidden()
    await expect(custom).toHaveAttribute('aria-expanded', 'false')
    for (const button of await palettes.getByRole('button').all()) {
      expect(await button.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
    }
  }
  await expect(page.getByTestId('cumulative-samples')).toHaveText(total)
  await page.getByRole('button', { name: 'RESET SIMULATION', exact: true }).click()
  await expect(opacity).toHaveAttribute('aria-valuenow', '0.25')
  await expect(palettes.getByRole('button', { name: 'Mint', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await custom.click()
  await expect(dialog.getByLabel('Selected color', { exact: true })).toHaveText('#72DDC8')
  expect(errors).toEqual([])
})
