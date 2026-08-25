// SVG series-path helper — exact port of DCLogic.path() from the prototype.

export interface SeriesPath {
  line: string
  area: string
  pts: [number, number][]
  mx: number
}

export function seriesPath(
  vals: number[],
  w: number,
  h: number,
  p: number,
  max?: number,
): SeriesPath {
  const mx = max || Math.max(...vals) * 1.06
  const n = vals.length
  const pts = vals.map(
    (v, i) => [p + (i * (w - 2 * p)) / (n - 1), h - p - (v / mx) * (h - 2 * p)] as [number, number],
  )
  const line = 'M' + pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L')
  const area = line + 'L' + (w - p) + ',' + (h - p) + 'L' + p + ',' + (h - p) + 'Z'
  return { line, area, pts, mx }
}
