// Demo dataset — an exact port of the seeded generators in the Hearth App
// design prototype, so every number on screen matches the design.
// Electric: 30 days normalized to 1,687.8 kWh / $686.10 (avg rate $0.4065/kWh
// before cost renormalization). Gas: 24.3 therms / $38.20.

export interface DayDatum {
  dt: Date
  dow: number
  usage: number
  cost: number
}

export interface EnergyDataset {
  /** Electric daily series, Jul 25 – Aug 23, 2026 (30 days). */
  days: DayDatum[]
  /** Gas daily series over the same window. */
  gdays: DayDatum[]
  /** Typical hourly load-shape profile (24 relative values). */
  prof: number[]
}

/** Park–Miller LCG — same generator the prototype uses (deterministic). */
export function makeRng(seed: number): () => number {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export const CYCLE_START = new Date(2026, 6, 25)

let cached: EnergyDataset | null = null

export function getDataset(): EnergyDataset {
  if (cached) return cached

  const rnd = makeRng(42)
  const days: DayDatum[] = []
  for (let i = 0; i < 30; i++) {
    const dt = new Date(CYCLE_START)
    dt.setDate(CYCLE_START.getDate() + i)
    const dow = dt.getDay()
    const wk = dow === 0 || dow === 6
    let u = (wk ? 61 : 53) * (0.86 + rnd() * 0.28)
    if (i === 9) u = 97
    if (i === 21) u = 88
    if (i === 13) u = 19
    days.push({ dt, dow, usage: u, cost: 0 })
  }
  const su = days.reduce((a, d) => a + d.usage, 0)
  const k = 1687.8 / su
  days.forEach((d) => {
    d.usage *= k
    d.cost = d.usage * 0.4065
  })
  const sc = days.reduce((a, d) => a + d.cost, 0)
  const kc = 686.10 / sc
  days.forEach((d) => (d.cost *= kc))

  const prof = [
    0.9, 0.85, 0.8, 0.8, 0.85, 1.0, 1.4, 1.8, 1.9, 1.7, 1.6, 1.5, 1.6, 1.8,
    2.1, 2.6, 3.4, 3.9, 4.2, 4.0, 3.4, 2.6, 1.8, 1.2,
  ]

  const rnd2 = makeRng(7)
  const gdays: DayDatum[] = days.map((d, i) => {
    const on = rnd2() < 0.36
    let u = on ? 0.9 + rnd2() * 0.4 : 0.08 + rnd2() * 0.14
    if (i === 26) u = 2.1
    return { dt: d.dt, dow: d.dow, usage: u, cost: 0 }
  })
  const gsu = gdays.reduce((a, d) => a + d.usage, 0)
  const gk = 24.3 / gsu
  gdays.forEach((d) => {
    d.usage *= gk
    d.cost = d.usage * (38.20 / 24.3)
  })

  cached = { days, gdays, prof }
  return cached
}

export interface HeatCell {
  c: string
  ring: string
  tip: string
}

export interface HeatRow {
  label: string
  cells: HeatCell[]
}

/**
 * Hourly heatmap for the last 14 electric days (seed 11, same call order as
 * the prototype: one draw per cell, spike override after the draw).
 */
export function buildHeatRows(light: boolean): { heatRows: HeatRow[]; ramp: string[] } {
  const D = getDataset()
  const ramp = [
    light ? '#ecece7' : 'rgb(23,23,23)',
    light ? '#c9d9ef' : 'rgb(21,38,62)',
    'rgb(24,74,106)',
    'rgb(31,116,96)',
    'rgb(122,160,58)',
    'rgb(217,161,59)',
    'rgb(224,100,47)',
    'rgb(210,59,59)',
  ]
  const r3 = makeRng(11)
  const heatRows = D.days.slice(-14).map((d, ri) => {
    const f = d.usage / 56
    return {
      label: d.dt
        .toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
        .replace(',', ''),
      cells: D.prof.map((pv, h) => {
        let v = pv * f * (0.8 + r3() * 0.4)
        const spike = ri === 10 && h >= 17 && h <= 19
        if (spike) v = 6.5
        const t = Math.min(1, v / 5.6)
        const c = ramp[Math.min(7, Math.floor(t * 8))]
        return {
          c,
          ring: spike
            ? light
              ? '0 0 0 1.5px rgb(10,10,10)'
              : '0 0 0 1.5px rgb(245,245,245)'
            : 'none',
          tip: v.toFixed(1) + ' kWh · ' + (h % 12 || 12) + (h < 12 ? ' AM' : ' PM'),
        }
      }),
    }
  })
  return { heatRows, ramp }
}
