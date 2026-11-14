const rules = new Map<number, { x: number; w: number }[]>()

function gaussRule(n: number) {
  let rule = rules.get(n)
  if (!rule) {
    rule = []
    for (let i = 1; i <= Math.ceil(n / 2); i++) {
      let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), derivative = 0
      for (let iteration = 0; iteration < 30; iteration++) {
        let previous = 1, current = x
        for (let l = 2; l <= n; l++) { const next = ((2 * l - 1) * x * current - (l - 1) * previous) / l; previous = current; current = next }
        derivative = n * (x * current - previous) / (x * x - 1)
        const next = x - current / derivative
        if (Math.abs(next - x) < 1e-15) { x = next; break }
        x = next
      }
      const w = 2 / ((1 - x * x) * derivative * derivative)
      rule.push({ x, w })
      if (rule.length < n) rule.push({ x: -x, w })
    }
    rules.set(n, rule)
  }
  return rule
}

/** Gauss–Legendre quadrature: n points integrate polynomials through degree 2n−1. */
export function integrateGauss(f: (x: number) => number, min: number, max: number, n = 64) {
  const half = (max - min) / 2, center = (max + min) / 2
  return half * gaussRule(n).reduce((sum, point) => sum + point.w * f(center + half * point.x), 0)
}

/** Integrate related components together, evaluating the shared integrand once per point. */
export function integrateGaussVector(f: (x: number) => number[], min: number, max: number, n = 64) {
  const half = (max - min) / 2, center = (max + min) / 2
  let sums: number[] | undefined
  for (const point of gaussRule(n)) {
    const values = f(center + half * point.x)
    if (!sums) sums = Array(values.length).fill(0)
    for (let k = 0; k < values.length; k++) sums[k] += point.w * values[k]
  }
  return (sums ?? []).map(sum => half * sum)
}
