import { expect, test } from '@playwright/test'

test('hydrogen views render, quantum controls clamp, and reset restores 2p', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Hedione's Atomic Orbital Visualizer", exact: true })).toBeAttached()
  await expect(page.locator('canvas')).toHaveCount(3)
  await expect.poll(async () => Number((await page.getByTestId('cumulative-samples').textContent())?.replaceAll(',', ''))).toBeGreaterThan(0)
  await expect(page.getByText('Particles & bond')).toHaveCount(0)
  await expect(page.getByTestId('energy-value')).toContainText('-3.401')
  await expect(page.getByRole('slider', { name: 'Electron opacity', exact: true })).toHaveAttribute('aria-valuenow', '0.25')
  await expect(page.getByRole('slider', { name: 'Visual density', exact: true })).toHaveAttribute('aria-valuenow', '1')
  await page.getByRole('button', { name: 'Solid-angle probability', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Solid-angle integrated polar electron probability per theta', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Density vs cos θ', exact: true }).click()
  await page.getByRole('button', { name: 'Evolve in time', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).fill('0')
  await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).press('Enter')
  await expect(page.getByTestId('orbital-label')).toContainText('2s')
  await page.screenshot({ path: 'test-results/hydrogen-2s-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Explore high n', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'n', exact: true }).fill('20')
  await page.getByRole('spinbutton', { name: 'n', exact: true }).press('Enter')
  await expect(page.getByTestId('scene-ensemble')).toHaveAttribute('data-n', '20')
  await page.getByRole('button', { name: 'RESET SIMULATION' }).click()
  await expect(page.getByTestId('orbital-label')).toContainText('2p')
  await expect(page.getByRole('button', { name: 'Real orbital combinations', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('real p orbitals and adjustable volume quantities render correctly', async ({ page }) => {
  // Software WebGL needs several rendered frames for each pixel comparison.
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Evolve in time', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Real orbital combinations', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const orbital = page.getByRole('slider', { name: 'Orbital', exact: true })
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await page.getByRole('button', { name: 'Next orbital', exact: true }).click()
  await expect(orbital).toHaveAttribute('aria-valuenow', '1')
  await expect(page.getByTestId('orbital-label')).toHaveText('2px')
  await expect(page.getByTestId('orbital-label').locator('sub')).toHaveText('x')
  await expect(page.getByTestId('z-projection')).toContainText('0.000')
  await expect(page.getByTestId('scene-ensemble')).toHaveAttribute('data-orbital-basis', 'real')
  const combination = page.getByTestId('real-orbital-combination')
  await expect(combination.locator('.math-block')).toHaveAttribute('aria-label', String.raw`\psi_{\mathrm{real}} = \frac{-\psi_{2,1,1} + \psi_{2,1,-1}}{\sqrt{2}}`)
  await expect(combination.locator('.katex-error')).toHaveCount(0)
  const caption = page.getByTestId('orbital-label').locator('..')
  const placement = await caption.evaluate(element => {
    const name = element.querySelector('.orbital-name')!.getBoundingClientRect()
    const formula = element.querySelector('.real-orbital-combination')!.getBoundingClientRect()
    const row = element.getBoundingClientRect()
    return { rowCenter: row.x + row.width / 2, contentCenter: (name.left + formula.right) / 2, nameCenter: name.y + name.height / 2, formulaCenter: formula.y + formula.height / 2 }
  })
  expect(Math.abs(placement.rowCenter - placement.contentCenter)).toBeLessThan(2)
  expect(Math.abs(placement.nameCenter - placement.formulaCenter)).toBeLessThan(2)
  await expect(page.getByText('Normalized combination of complex', { exact: false })).toHaveCount(0)
  await combination.screenshot({ path: 'test-results/real-orbital-combination-desktop.png' })
  const view = page.getByTestId('scene-wavefunction')
  const brightness = page.getByRole('slider', { name: 'Volume brightness', exact: true })
  await expect(brightness).toHaveAttribute('aria-valuenow', '1')
  await expect(brightness).toHaveAttribute('aria-valuemax', '10')
  const volume = await view.screenshot()
  // Nominal 5× restores the old 1× calibration; nominal 1× remains the default/reset value.
  await brightness.fill('8495')
  await expect(brightness).toHaveAttribute('aria-valuenow', '5')
  await expect.poll(async () => !(await view.screenshot()).equals(volume), { timeout: 15000 }).toBe(true)
  await brightness.dblclick()
  await expect(brightness).toHaveAttribute('aria-valuenow', '1')
  await expect.poll(async () => (await view.screenshot()).equals(volume), { timeout: 15000 }).toBe(true)
  await expect(page.getByRole('group', { name: 'Wavefunction quantity' }).getByRole('button')).toHaveCount(4)
  for (const name of ['Probability density', 'Real component', 'Imaginary component']) {
    const quantity = page.getByRole('group', { name: 'Wavefunction quantity' }).getByRole('button', { name, exact: true })
    await quantity.click()
    await expect(quantity).toHaveAttribute('aria-pressed', 'true')
    if (name === 'Probability density') await expect.poll(async () => !(await view.screenshot()).equals(volume), { timeout: 15000 }).toBe(true)
  }
  await expect(view.getByText('Im(ψ) = 0', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Wavefunction', exact: true }).click()
  await view.screenshot({ path: 'test-results/hydrogen-px-volume.png' })
  await orbital.fill('-1')
  await expect(page.getByTestId('orbital-label')).toHaveText('2py')
  await expect(combination.locator('.math-block')).toHaveAttribute('aria-label', String.raw`\psi_{\mathrm{real}} = \frac{-\psi_{2,1,1} - \psi_{2,1,-1}}{i\sqrt{2}}`)
  await orbital.fill('0')
  await expect(page.getByTestId('orbital-label')).toHaveText('2pz')
  await page.getByRole('button', { name: 'RESET SIMULATION' }).click()
  await expect(page.getByRole('button', { name: 'Real orbital combinations', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(combination).toBeVisible()
  await expect(brightness).toHaveAttribute('aria-valuenow', '1')
  expect(errors).toEqual([])
})

test('transition mode uses hydrogen selection rules, populations, and photon energies', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Real orbital combinations', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to Transition mode' }).click()
  await page.getByRole('button', { name: 'I understand' }).click()
  await page.getByRole('slider', { name: 'n', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Final n = 2', exact: true }).click()
  await expect(page.getByTestId('scene-field')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeEnabled()
  await expect.poll(async () => Number(await page.getByTestId('photon-wavelength').getAttribute('data-metres')) * 1e9).toBeCloseTo(121.502, 2)
  await page.getByRole('slider', { name: 'π-pulse progress', exact: true }).fill('50')
  await expect(page.getByRole('progressbar', { name: 'Final population' })).toHaveAttribute('value', /0\.49|0\.5/)
  await page.getByTestId('scene-field').screenshot({ path: 'test-results/field-linear-scaled.png' })
  await page.getByRole('button', { name: 'Δmℓ = +1' }).click()
  await expect(page.getByTestId('transition-result')).toHaveAttribute('data-polarization', 'sigmaPlus')
  await page.getByRole('slider', { name: 'π-pulse progress', exact: true }).fill('50')
  await page.getByTestId('scene-field').screenshot({ path: 'test-results/field-circular-scaled.png' })
  // Drag past the north pole so damping settles at OrbitControls' exact top-view limit.
  const fieldCanvas = page.getByTestId('scene-field').locator('canvas'), bounds = (await fieldCanvas.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 3)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * 2 / 3, { steps: 12 })
  await page.mouse.up()
  const ringWidth = async () => {
    const png = (await page.getByTestId('scene-field').screenshot()).toString('base64')
    return page.evaluate(async png => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob())
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0); image.close()
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data, radii: number[] = []
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4, r = data[index], g = data[index + 1], b = data[index + 2]
        const radius = Math.hypot(x + 0.5 - canvas.width / 2, y + 0.5 - canvas.height / 2)
        if (g > 100 && b > 110 && r < g * 0.6 && b > g * 0.85 && b < g * 1.5 && radius > 15) radii.push(radius)
      }
      radii.sort((a, b) => a - b)
      return { count: radii.length, spread: radii[Math.floor(radii.length * 0.75)] - radii[Math.floor(radii.length * 0.25)] }
    }, png)
  }
  await expect.poll(async () => (await ringWidth()).count).toBeGreaterThan(100)
  await expect.poll(async () => (await ringWidth()).spread, { timeout: 15000 }).toBeLessThan(2.5)
  await page.getByTestId('scene-field').screenshot({ path: 'test-results/field-circular-top.png' })
  await expect(page.getByRole('spinbutton', { name: 'Final n', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Final n = 1', exact: true }).click()
  await expect(page.getByTestId('transition-validation')).toHaveText('These states are degenerate in this model: no finite-frequency resonant photon.')
  await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})

test('real transitions use orbital coupling and keep six final-n buttons on one row', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to Transition mode', exact: true }).click()
  await page.getByRole('button', { name: 'I understand', exact: true }).click()
  await page.getByRole('slider', { name: 'n', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Final n = 2', exact: true }).click()
  const basis = page.getByRole('button', { name: 'Real orbital combinations', exact: true })
  await expect(basis).toBeEnabled()
  await expect(basis).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('slider', { name: 'Final n', exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Change in mℓ', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Explore high n', exact: true })).toBeDisabled()
  for (const [name, polarization, axis] of [['p x', 'linearX', 'x'], ['p y', 'linearY', 'y'], ['p z', 'pi', 'z']]) {
    await page.getByRole('button', { name: `Final orbital ${name}`, exact: true }).click()
    await expect(page.getByTestId('transition-result')).toHaveAttribute('data-polarization', polarization)
    await expect(page.getByTestId('scene-ensemble')).toHaveAttribute('data-orbital-basis', 'real')
    await page.getByRole('slider', { name: 'π-pulse progress', exact: true }).fill('37')
    const fields = page.getByTestId('field-dipole-readouts')
    for (const key of ['x', 'y', 'z']) {
      if (key === axis) await expect.poll(async () => Math.abs(Number(await fields.getAttribute(`data-e${key}`)))).toBeGreaterThan(0.1)
      else {
        await expect(fields).toHaveAttribute(`data-e${key}`, '0')
        await expect(fields).toHaveAttribute(`data-mu${key}`, '0')
      }
    }
    await expect.poll(async () => Math.abs(Number(await fields.getAttribute(`data-mu${axis}`)))).toBeGreaterThan(0.01)
  }
  await page.getByRole('slider', { name: 'n', exact: true }).fill('2')
  await page.getByRole('slider', { name: 'ℓ', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Final n = 3', exact: true }).click()
  await page.getByRole('slider', { name: 'Orbital', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Final orbital d xy', exact: true }).click()
  await expect(page.getByTestId('transition-result')).toHaveAttribute('data-m', '-2')
  await expect(page.getByTestId('transition-result')).toHaveAttribute('data-polarization', 'linearY')
  await expect(page.getByRole('button', { name: 'Final orbital d yz', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeEnabled()
  await page.screenshot({ path: 'test-results/real-transition-desktop.png', fullPage: true })
  await page.getByRole('slider', { name: 'n', exact: true }).fill('5')
  await page.getByRole('slider', { name: 'ℓ', exact: true }).fill('4')
  await page.getByRole('button', { name: 'Final n = 6', exact: true }).click()
  const finalN = page.getByRole('group', { name: 'Final principal quantum number', exact: true })
  for (const width of [1440, 1100, 720, 320]) {
    await page.setViewportSize({ width, height: 1050 })
    const mobile = page.getByRole('button', { name: 'SIMULATION SETTINGS', exact: true })
    if (await mobile.isVisible() && await mobile.getAttribute('aria-expanded') === 'false') await mobile.click()
    await finalN.scrollIntoViewIfNeeded()
    const boxes = await finalN.getByRole('button').evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, right: rect.right, height: rect.height }
    }))
    expect(boxes).toHaveLength(6)
    for (const box of boxes) { expect(box.y).toBeCloseTo(boxes[0].y, 1); expect(box.height).toBeCloseTo(36, 3); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width) }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const orbitals = page.getByRole('group', { name: 'Final real orbital', exact: true })
    const layout = await orbitals.getByRole('button').evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect(); return { x: bounds.x, y: bounds.y }
    }))
    expect(layout).toHaveLength(11)
    expect(layout[0].y).toBe(layout[1].y); expect(layout[1].y).toBe(layout[2].y)
    expect(layout[3].y).toBeGreaterThan(layout[0].y); expect(layout[3].x).toBe(layout[0].x)
    for (const button of await orbitals.getByRole('button').all()) {
      expect(await button.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    }
    if (width === 320) await page.getByRole('region', { name: 'Final state and selection rules', exact: true }).screenshot({ path: 'test-results/real-transition-mobile.png' })
  }
  await page.getByRole('button', { name: 'Final n = 5', exact: true }).click()
  await expect(page.getByTestId('transition-validation')).toHaveText('These states are degenerate in this model: no finite-frequency resonant photon.')
  await page.getByRole('region', { name: 'Final state and selection rules', exact: true }).screenshot({ path: 'test-results/real-transition-degenerate-mobile.png' })
  expect(errors).toEqual([])
})

test('evolution stays nominally 1× at 2 fs/s and mode entries survive switching', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const evolution = page.getByRole('slider', { name: 'Evolution playback speed', exact: true })
  await expect(evolution).toHaveAttribute('aria-valuenow', '1')
  await expect(evolution.locator('..')).toContainText('2 fs/s')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  const n = page.getByRole('slider', { name: 'n', exact: true }), cloud = page.getByTestId('scene-ensemble')
  await n.fill('4'); await page.getByRole('slider', { name: 'ℓ', exact: true }).fill('2')
  await page.getByRole('slider', { name: 'Orbital', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Switch to Transition mode', exact: true }).click()
  await page.getByRole('button', { name: 'I understand', exact: true }).click()
  await expect(cloud).toHaveAttribute('data-n', '2'); await expect(cloud).toHaveAttribute('data-l', '1'); await expect(cloud).toHaveAttribute('data-m', '0')
  await expect(page.getByRole('button', { name: 'Final n = 3', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('transition-result')).toHaveAttribute('data-l', '2')
  await n.fill('3')
  await page.getByRole('button', { name: 'Final n = 4', exact: true }).click()
  await page.getByRole('slider', { name: 'Orbital', exact: true }).fill('1')
  await page.getByRole('button', { name: 'Final orbital d xy', exact: true }).click()
  await page.getByRole('button', { name: 'Loop mode', exact: true }).click()
  await page.getByRole('slider', { name: 'Playback speed', exact: true }).fill('10000')
  const rabi = page.getByRole('slider', { name: 'Rabi Ω : light ω multiple', exact: true })
  await rabi.fill('7500')
  const ratio = await rabi.getAttribute('aria-valuenow')
  await page.getByRole('button', { name: 'Switch to Static mode', exact: true }).click()
  await expect(cloud).toHaveAttribute('data-n', '4'); await expect(cloud).toHaveAttribute('data-l', '2'); await expect(cloud).toHaveAttribute('data-m', '1')
  await n.fill('5')
  const basis = page.getByRole('button', { name: 'Real orbital combinations', exact: true })
  await basis.click()
  await page.getByRole('button', { name: 'Switch to Transition mode', exact: true }).click()
  await expect(basis).toHaveAttribute('aria-pressed', 'true')
  await expect(cloud).toHaveAttribute('data-n', '3'); await expect(cloud).toHaveAttribute('data-l', '1'); await expect(cloud).toHaveAttribute('data-m', '1')
  await expect(page.getByRole('button', { name: 'Final n = 4', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('transition-result')).toHaveAttribute('data-m', '-2')
  await expect(page.getByTestId('transition-result')).toHaveAttribute('data-polarization', 'linearY')
  await expect(page.getByRole('button', { name: 'Loop mode', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('slider', { name: 'Playback speed', exact: true })).toHaveAttribute('aria-valuenow', '10')
  await expect(rabi).toHaveAttribute('aria-valuenow', ratio!)
  await page.getByRole('button', { name: 'Switch to Static mode', exact: true }).click()
  await expect(cloud).toHaveAttribute('data-n', '5'); await expect(basis).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'RESET SIMULATION', exact: true }).click()
  await expect(evolution).toHaveAttribute('aria-valuenow', '1')
  await page.getByRole('button', { name: 'Switch to Transition mode', exact: true }).click()
  await expect(cloud).toHaveAttribute('data-n', '2'); await expect(cloud).toHaveAttribute('data-l', '1'); await expect(cloud).toHaveAttribute('data-m', '0')
  await expect(page.getByRole('button', { name: 'Final n = 3', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Loop mode', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('slider', { name: 'Playback speed', exact: true })).toHaveAttribute('aria-valuenow', '1')
  await page.screenshot({ path: 'test-results/transition-default-2pz.png', fullPage: true })
  expect(errors).toEqual([])
})

test('repeated n changes recover from degenerate transitions without crashing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const n = page.getByRole('slider', { name: 'n', exact: true })
  const cloud = page.getByTestId('scene-ensemble')
  for (const value of ['3', '4', '1', '2']) {
    await n.fill(value)
    await expect(cloud).toHaveAttribute('data-n', value)
  }
  await page.getByRole('button', { name: 'Switch to Transition mode' }).click()
  await page.getByRole('button', { name: 'I understand', exact: true }).click()
  await n.fill('1')
  await page.getByRole('button', { name: 'Final n = 2', exact: true }).click()
  for (const looping of [false, true]) {
    if (looping) {
      await page.getByRole('button', { name: 'Loop mode', exact: true }).click()
      await page.getByRole('button', { name: 'Real orbital combinations', exact: true }).click()
    }
    for (const value of ['2', '3', '4', '2', '1']) {
      await n.fill(value)
      await expect(cloud).toHaveAttribute('data-n', value)
      if (value === '2') {
        await expect(page.getByTestId('transition-validation')).toHaveText('These states are degenerate in this model: no finite-frequency resonant photon.')
        await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeDisabled()
        for (const name of ['Transition selections', 'Transition playback controls']) {
          const group = page.getByRole('group', { name, exact: true })
          for (const element of await group.locator('button, input').all()) await expect(element).toBeDisabled()
        }
        await expect(page.getByRole('button', { name: 'Final n = 3', exact: true })).toBeEnabled()
      } else await expect(page.getByRole('button', { name: 'Play transition', exact: true })).toBeEnabled()
    }
    for (const value of ['1', '3', '1', '2']) {
      await page.getByRole('button', { name: `Final n = ${value}`, exact: true }).click()
      const play = page.getByRole('button', { name: 'Play transition', exact: true })
      if (value === '1') await expect(play).toBeDisabled()
      else await expect(play).toBeEnabled()
    }
    await page.getByRole('slider', { name: looping ? 'Rabi cycle phase' : 'π-pulse progress', exact: true }).fill(looping ? '90' : '50')
    await expect.poll(async () => Number(await page.getByRole('progressbar', { name: 'Final population' }).getAttribute('value'))).toBeCloseTo(0.5, 6)
    await page.getByRole('button', { name: 'Reset transition', exact: true }).click()
  }
  await expect(page.locator('canvas')).toHaveCount(3)
  await expect(page.locator('.webgl-fallback')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Bohr and cloud share physical scale through zoom, state changes, and resizing', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // Observe the actual GPU point-size uniform without adding test hooks to the app.
  await page.addInitScript(() => {
    const sizes = new WeakSet<WebGLUniformLocation>()
    const prototype = WebGL2RenderingContext.prototype
    const getLocation = prototype.getUniformLocation, setFloat = prototype.uniform1f
    prototype.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name)
      if (location && name === 'size') sizes.add(location)
      return location
    }
    prototype.uniform1f = function (location, value) {
      if (location && sizes.has(location) && this.canvas instanceof HTMLCanvasElement) {
        this.canvas.dataset.pointPixels = String(value / Math.max(1, Math.min(1.25, devicePixelRatio)))
      }
      setFloat.call(this, location, value)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  const n = page.getByRole('spinbutton', { name: 'n', exact: true })
  await n.fill('1'); await n.press('Enter')
  const bohr = page.getByTestId('scene-classical'), cloud = page.getByTestId('scene-ensemble')
  await expect(bohr).toHaveAttribute('data-radius-a0', '1')
  await expect(bohr.locator('.physical-extent')).toHaveText('r = 1 a₀ · 52.9 pm')
  const scales = page.locator('.scale-readout')
  await expect(scales).toHaveCount(3)
  await expect.poll(() => scales.evaluateAll(elements => elements.every(element => Number((element as HTMLElement).dataset.metres) > 0))).toBe(true)
  const physicalScale = (view: typeof bohr) => view.locator('.scale-readout').evaluate(element => Number((element as HTMLElement).dataset.metres) / parseFloat((element as HTMLElement).style.getPropertyValue('--scale-width')))
  const matchingScales = () => expect.poll(async () => (await physicalScale(bohr)) / (await physicalScale(cloud)), { timeout: 15000 }).toBeCloseTo(1, 3)
  await matchingScales()
  const initial = await scales.evaluateAll(elements => elements.map(element => Number((element as HTMLElement).dataset.metres)))
  const canvas = cloud.locator('canvas')
  const pointSize = async () => Number(await canvas.getAttribute('data-point-pixels'))
  const metresPerPixel = () => cloud.locator('.scale-readout').evaluate(element => Number((element as HTMLElement).dataset.metres) / parseFloat((element as HTMLElement).style.getPropertyValue('--scale-width')))
  await expect.poll(pointSize).toBeCloseTo(4, 6)
  const density = page.getByRole('slider', { name: 'Visual density', exact: true })
  await density.fill('0.5')
  await expect.poll(pointSize).toBeCloseTo(2, 6)
  await density.dblclick()
  await expect(density).toHaveAttribute('aria-valuenow', '1')
  await expect.poll(pointSize).toBeCloseTo(4, 6)
  const initialMetresPerPixel = await metresPerPixel()
  await canvas.hover()
  for (let step = 0; step < 10; step++) await page.mouse.wheel(0, 100)
  await expect.poll(pointSize).toBeLessThan(4)
  await matchingScales()
  await expect.poll(async () => (await pointSize()) * (await metresPerPixel()) / initialMetresPerPixel).toBeCloseTo(4, 2)
  // OrbitControls applies one fixed zoom step per wheel event, regardless of delta magnitude.
  for (let step = 0; step < 65; step++) await page.mouse.wheel(0, -100)
  // The former 3.2-unit camera limit cannot reach one-fifth of the starting scale.
  await expect.poll(() => scales.evaluateAll((elements, original) => elements.every((element, i) => Number((element as HTMLElement).dataset.metres) < original[i] / 5), initial), { timeout: 15000 }).toBe(true)
  await expect.poll(pointSize).toBeGreaterThan(20)
  await matchingScales()
  await expect.poll(async () => (await pointSize()) * (await metresPerPixel()) / initialMetresPerPixel).toBeCloseTo(4, 2)
  await cloud.screenshot({ path: 'test-results/hydrogen-close-zoom.png' })
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click()
  await expect.poll(() => scales.evaluateAll(elements => elements.map(element => Number((element as HTMLElement).dataset.metres)))).toEqual(initial)
  await expect.poll(pointSize).toBeCloseTo(4, 6)
  await matchingScales()
  await n.fill('2'); await n.press('Enter')
  await expect(bohr.locator('.physical-extent')).toHaveText('r = 4 a₀ · 212 pm')
  await page.getByRole('button', { name: 'Superposition mode', exact: true }).click()
  await expect(bohr.locator('.physical-extent > span')).toHaveText(['r1 = 4 a₀ · 212 pm', 'r2 = 9 a₀ · 476 pm'])
  await matchingScales()
  await page.screenshot({ path: 'test-results/hydrogen-scales-desktop.png', fullPage: true })
  for (const width of [1100, 720, 320]) {
    await page.setViewportSize({ width, height: 1050 })
    await matchingScales()
  }
  expect(errors).toEqual([])
})

test('superposition and narrow layouts retain usable controls and three distributions', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'n', exact: true }).fill('4')
  await page.getByRole('spinbutton', { name: 'n', exact: true }).press('Enter')
  await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).fill('3')
  await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).press('Enter')
  await page.getByRole('slider', { name: 'Orbital', exact: true }).fill('3')
  await page.getByRole('button', { name: 'Superposition mode', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Second n', exact: true }).fill('1')
  await page.getByRole('spinbutton', { name: 'Second n', exact: true }).press('Enter')
  await expect(page.locator('[data-displayed-n2="1"]')).toBeAttached()
  for (const width of [1100, 720, 320]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    await expect(page.locator('.radial-chart svg')).toBeAttached()
    await expect(page.locator('.polar-chart svg')).toBeAttached()
    await expect(page.locator('.azimuthal-chart svg')).toBeAttached()
    const grid = await page.getByRole('group', { name: 'Wavefunction quantity' }).getByRole('button').evaluateAll(elements => elements.map(element => {
      const { x, y } = element.getBoundingClientRect(); return { x, y }
    }))
    expect(grid).toHaveLength(4)
    expect(grid[0].y).toBe(grid[1].y); expect(grid[2].y).toBe(grid[3].y)
    expect(grid[0].x).toBe(grid[2].x); expect(grid[1].x).toBe(grid[3].x)
    expect(grid[2].y).toBeGreaterThan(grid[0].y)
  }
  await page.getByRole('button', { name: 'SIMULATION SETTINGS' }).click()
  await expect(page.getByRole('spinbutton', { name: 'n', exact: true })).toBeVisible()
  await expect(page.getByTestId('real-orbital-combination')).toBeVisible()
  await expect(page.getByTestId('second-real-orbital-combination')).toBeVisible()
  await expect(page.getByLabel('Orbital selection', { exact: true }).locator('sub')).toHaveText('x(x²−3y²)')
  expect(await page.getByLabel('Orbital selection', { exact: true }).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  const fields = page.locator('.hydrogen-steppers').first().locator('.stepper > div')
  const before = await fields.evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
  await page.getByRole('spinbutton', { name: 'n', exact: true }).fill('5')
  await page.getByRole('spinbutton', { name: 'n', exact: true }).press('Enter')
  for (const l of [0, 1, 2, 3, 4]) {
    await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).fill(String(l))
    await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).press('Enter')
    if (l === 4) await page.getByRole('slider', { name: 'Orbital', exact: true }).fill('-1')
    const dimensions = await fields.evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
    expect(dimensions).toEqual(before)
  }
  const selection = page.getByLabel('Orbital selection', { exact: true })
  await expect(selection).toHaveText('gyz³')
  expect(await selection.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await selection.locator('span').evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(20)
  await page.getByRole('button', { name: 'Real orbital combinations', exact: true }).click()
  const complexLabel = page.getByTestId('orbital-label')
  const centered = await complexLabel.evaluate(element => {
    const bounds = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect()
    return { offset: Math.abs(bounds.x + bounds.width / 2 - parent.x - parent.width / 2), fontSize: Number.parseFloat(getComputedStyle(element).fontSize) }
  })
  expect(centered.offset).toBeLessThan(2); expect(centered.fontSize).toBeGreaterThanOrEqual(14)
  await page.getByRole('button', { name: 'Real orbital combinations', exact: true }).click()
  await expect(page.locator('.katex-error')).toHaveCount(0)
  const checkFormula = async () => {
    for (const element of await page.locator('.orbital-caption, .real-orbital-combination, .real-orbital-combination .math-block').all()) {
      const layout = await element.evaluate(element => {
        const style = getComputedStyle(element)
        return { className: element.className, width: element.clientWidth, content: element.scrollWidth, overflowX: style.overflowX, overflowY: style.overflowY, fits: element.scrollWidth <= element.clientWidth + 1 }
      })
      expect(layout.overflowX).toBe('visible'); expect(layout.overflowY).toBe('visible'); expect(layout.fits, JSON.stringify(layout)).toBe(true)
    }
  }
  await checkFormula()
  for (const [n, l, m] of [[5, 3, -1], [6, 5, -5], [6, 5, 5]]) {
    await page.getByRole('spinbutton', { name: 'n', exact: true }).fill(String(n))
    await page.getByRole('spinbutton', { name: 'n', exact: true }).press('Enter')
    await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).fill(String(l))
    await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).press('Enter')
    await page.getByRole('slider', { name: 'Orbital', exact: true }).fill(String(m))
    await checkFormula()
    if (n === 5) await page.getByTestId('orbital-label').locator('..').screenshot({ path: 'test-results/formula-5f-mobile.png' })
  }
  await page.getByRole('button', { name: 'Explore high n', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'n', exact: true }).fill('20')
  await page.getByRole('spinbutton', { name: 'n', exact: true }).press('Enter')
  await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).fill('19')
  await page.getByRole('spinbutton', { name: 'ℓ', exact: true }).press('Enter')
  for (const m of [-19, 0, 19]) {
    await page.getByRole('slider', { name: 'Orbital', exact: true }).fill(String(m))
    await checkFormula()
  }
  await page.getByRole('complementary', { name: 'Simulation controls' }).screenshot({ path: 'test-results/orbital-controls-mobile.png' })
  await page.getByTestId('real-orbital-combination').screenshot({ path: 'test-results/real-orbital-combination-mobile.png' })
  await page.getByRole('button', { name: 'SIMULATION SETTINGS' }).click()
  await page.getByTestId('scene-ensemble').screenshot({ path: 'test-results/orbital-scale-mobile.png' })
  await page.screenshot({ path: 'test-results/hydrogen-mobile.png', fullPage: true })
})
