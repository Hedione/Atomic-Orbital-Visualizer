import { expect, test } from '@playwright/test'
import { selectMode } from './modes'

test('only Bloch is independent while all other cameras remain linked', async ({ page }) => {
  test.setTimeout(240000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // Observe rendered matrices without adding camera test hooks to the application.
  await page.addInitScript(() => {
    const names = new WeakMap<WebGLUniformLocation, string>()
    const prototype = WebGL2RenderingContext.prototype
    const getLocation = prototype.getUniformLocation, setMatrix = prototype.uniformMatrix4fv
    prototype.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name)
      if (location && ['modelViewMatrix', 'projectionMatrix'].includes(name)) names.set(location, name)
      return location
    }
    prototype.uniformMatrix4fv = function (location, transpose, values) {
      const name = location && names.get(location)
      if (name && this.canvas instanceof HTMLCanvasElement) {
        this.canvas.dataset[name] = JSON.stringify(Array.from(values, value => Number(value.toFixed(3))))
      }
      setMatrix.call(this, location, transpose, values)
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  await page.getByRole('button', { name: 'Evolve in time', exact: true }).click()
  await selectMode(page, 'Superposition mode')
  await page.getByRole('tab', { name: 'Bloch sphere', exact: true }).click()
  const canvases = ['bloch', 'ensemble', 'wavefunction'].map(mode => page.getByTestId(`scene-${mode}`).locator('canvas'))
  const read = (views = canvases) => Promise.all(views.map(canvas => canvas.evaluate(element => [element.dataset.modelViewMatrix, element.dataset.projectionMatrix])))
  const expectSameView = (actual: (string | undefined)[], expected: (string | undefined)[]) => {
    for (let matrix = 0; matrix < actual.length; matrix++) {
      const values = JSON.parse(actual[matrix]!) as number[], original = JSON.parse(expected[matrix]!) as number[]
      // Allow subpixel residuals from OrbitControls damping.
      values.forEach((value, entry) => expect(value).toBeCloseTo(original[entry], 2))
    }
  }
  const settle = async () => expect(await page.locator('canvas').evaluateAll(async elements => {
    let previous = '', stable = 0
    const deadline = performance.now() + 30000
    while (stable < 4 && performance.now() < deadline) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const current = JSON.stringify(elements.map(element => [element.dataset.modelViewMatrix, element.dataset.projectionMatrix]))
      stable = current === previous ? stable + 1 : 0
      previous = current
    }
    return stable === 4
  })).toBe(true)
  await expect.poll(async () => (await read()).every(values => values.every(Boolean))).toBe(true)
  await settle()
  const initial = await read()
  for (const [index, canvas] of canvases.entries()) {
    const before = await read(), bounds = (await canvas.boundingBox())!
    for (const gesture of ['orbit', 'pan', 'zoom']) {
      const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2
      await page.mouse.move(x, y)
      if (gesture === 'zoom') await page.mouse.wheel(0, -100)
      else {
        const button = gesture === 'pan' ? 'right' : 'left'
        await page.mouse.down({ button })
        await page.mouse.move(x + 35, y + 20, { steps: 8 })
        await page.mouse.up({ button })
      }
    }
    await settle()
    const after = await read()
    expect(after[index]).not.toEqual(before[index])
    if (index === 0) {
      expectSameView(after[1], before[1]); expectSameView(after[2], before[2])
    } else {
      expectSameView(after[0], before[0])
      expect(after[index === 1 ? 2 : 1]).not.toEqual(before[index === 1 ? 2 : 1])
    }
  }
  const blochView = (await read())[0]
  await page.getByRole('tab', { name: 'Bohr orbit', exact: true }).click()
  await settle()
  const physicalScale = (mode: string) => page.getByTestId(`scene-${mode}`).locator('.scale-readout').evaluate(element => Number((element as HTMLElement).dataset.metres) / parseFloat((element as HTMLElement).style.getPropertyValue('--scale-width')))
  await expect.poll(async () => await physicalScale('classical') / await physicalScale('ensemble')).toBeCloseTo(1, 3)
  const beforeBohr = await read(canvases.slice(1))
  await page.getByTestId('scene-classical').locator('canvas').hover()
  await page.mouse.wheel(0, -100)
  await settle()
  const afterBohr = await read(canvases.slice(1))
  afterBohr.forEach((view, index) => expect(view).not.toEqual(beforeBohr[index]))
  await page.getByRole('tab', { name: 'Bloch sphere', exact: true }).click()
  await settle()
  expectSameView((await read())[0], blochView)
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click()
  await settle()
  const reset = await read()
  reset.forEach((view, index) => expectSameView(view, initial[index]))
  await selectMode(page, 'Transition mode')
  await page.getByRole('button', { name: 'I understand', exact: true }).click()
  await page.getByRole('tab', { name: 'Field & dipole', exact: true }).click()
  await settle()
  const beforeField = await read(canvases.slice(1))
  await page.getByTestId('scene-field').locator('canvas').hover()
  await page.mouse.wheel(0, -100)
  await settle()
  const afterField = await read(canvases.slice(1))
  afterField.forEach((view, index) => expect(view).not.toEqual(beforeField[index]))
  await page.getByRole('button', { name: 'RESET SIMULATION', exact: true }).click()
  await settle()
  const fresh = await read(canvases.slice(1))
  fresh.forEach((view, index) => expectSameView(view, initial[index + 1]))
  expect(errors).toEqual([])
})

test('orbital basis toggle keeps the other controls in place', async ({ page }) => {
  test.setTimeout(180000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: 'Pause sampling', exact: true }).click()
  const basis = page.getByRole('button', { name: 'Real orbital combinations', exact: true })
  for (const width of [1440, 1100, 720, 320]) {
    await page.setViewportSize({ width, height: 1050 })
    const settings = page.getByRole('button', { name: 'SIMULATION SETTINGS', exact: true })
    if (await settings.isVisible() && await settings.getAttribute('aria-expanded') === 'false') await settings.click()
    for (const mode of ['Static mode', 'Superposition mode', 'Transition mode']) {
      await selectMode(page, mode)
      const acknowledgement = page.getByRole('button', { name: 'I understand', exact: true })
      if (await acknowledgement.isVisible()) await acknowledgement.click()
      if (await basis.getAttribute('aria-pressed') === 'false') await basis.click()
      const positions = () => page.locator('#quantum-mode-controls').evaluate(element => {
        const origin = element.getBoundingClientRect()
        return [...element.querySelectorAll('.stepper > div, input[type="range"], .state-navigation button')].map(control => {
          const rect = control.getBoundingClientRect()
          return [rect.x - origin.x, rect.y - origin.y, rect.width, rect.height]
        })
      })
      const before = await positions()
      await basis.click()
      expect(await positions(), `${mode}, ${width}px, OFF`).toEqual(before)
      await basis.click()
      expect(await positions(), `${mode}, ${width}px, ON`).toEqual(before)
      if (mode === 'Superposition mode') {
        await page.getByRole('slider', { name: 'State mix', exact: true }).fill('90')
        await expect(page.locator('#quantum-mode-controls')).not.toContainText(/Amplitudes:|State 1 \/ State 2 probabilities\.|Phase of State 2 relative to State 1 at t = 0\./)
      }
    }
  }
  await selectMode(page, 'Superposition mode')
  await page.locator('#quantum-mode-controls').screenshot({ path: 'test-results/compact-state-controls-mobile.png' })
  await page.setViewportSize({ width: 1440, height: 1050 })
  await page.locator('#quantum-mode-controls').screenshot({ path: 'test-results/compact-state-controls-desktop.png' })
})
