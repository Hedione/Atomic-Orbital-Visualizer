import type { Page } from '@playwright/test'

export async function selectMode(page: Page, name: string) {
  await page.getByRole('button', { name: 'Simulation mode', exact: true }).click()
  await page.getByRole('button', { name, exact: true }).click()
}
