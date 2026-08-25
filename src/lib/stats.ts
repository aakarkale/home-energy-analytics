// Robust statistics primitives. Utility data is heavy-tailed, so baselines
// use median/MAD rather than mean/σ (spikes must not drag their own baseline).

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Median absolute deviation, scaled to be σ-comparable (×1.4826). */
export function mad(xs: number[], med = median(xs)): number {
  if (!xs.length) return 0
  return 1.4826 * median(xs.map((x) => Math.abs(x - med)))
}

/** Linear-interpolated quantile, q in [0,1]. */
export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0)
}
