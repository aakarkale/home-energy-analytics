// Seeded demo series (Park–Miller LCG) — the same deterministic sample home
// the design prototype ships: 30 days, Jul 25 – Aug 23 2026, normalized to
// 1,687.8 kWh / $686.10 electric and 24.3 therms / $38.20 gas. sample.ts
// renders these as Green Button CSVs so demo mode exercises the real
// parser + analysis engine end to end.

export interface DayDatum {
  dt: Date
  dow: number
  usage: number
  cost: number
}

export interface EnergyDataset {
  days: DayDatum[]
  gdays: DayDatum[]
  prof: number[]
}

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
