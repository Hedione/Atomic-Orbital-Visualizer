import { expect, it, vi } from 'vitest'
import { integrateGauss, integrateGaussVector } from './integration'

it('integrates all components with one integrand evaluation per quadrature point', () => {
  const components = (x: number) => [1, x, x * x, x ** 14]
  const integrand = vi.fn(components)
  const result = integrateGaussVector(integrand, -1, 1, 8)
  expect(integrand).toHaveBeenCalledTimes(8)
  result.forEach((value, k) => {
    expect(value).toBe(integrateGauss(x => components(x)[k], -1, 1, 8))
    expect(value).toBeCloseTo([2, 0, 2 / 3, 2 / 15][k], 12)
  })
})

it.each([[0, 3], [4, -2], [2, 2]])('retains scalar quadrature for the interval [%s, %s]', (min, max) => {
  const f = (x: number) => [Math.exp(x), Math.sin(x), x ** 3, 0]
  const result = integrateGaussVector(f, min, max, 32)
  expect(result).toEqual(result.map((_, k) => integrateGauss(x => f(x)[k], min, max, 32)))
})
