// Demo mode's sample data: the seeded demo home rendered as genuine PG&E
// Green Button CSVs, then fed through the same parser + engine as a real
// upload — the demo shows exactly what a signed-up user sees, because it
// runs the exact same pipeline.

import { getDataset, makeRng } from './data'
import { parseGreenButtonCsv, type ParsedUpload } from './parse'
import type { ForecastDay } from './weather'

export const SAMPLE_ELECTRIC_NAME = 'pge_electric_usage_jul-aug.csv'
export const SAMPLE_GAS_NAME = 'pge_gas_usage_jul-aug.csv'

const PEAK_START = 16 // 4 PM
const PEAK_END = 20 // through 8:59 PM → "4–9 PM"
const PEAK_RATE = 0.52
const OFF_RATE = 0.39

function dateKey(dt: Date): string {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

let cachedElectric: string | null = null
let cachedGas: string | null = null

// Typical-day hour shape (kWh) for a ~56 kWh/day home: a true ~0.42 kWh/hr
// overnight standby, a morning ramp, and an AC-driven evening peak.
const HOUR_SHAPE = [
  0.42, 0.42, 0.42, 0.42, 0.42, 0.42, // 0-5 overnight standby
  1.2, 1.8, 1.9, // 6-8 morning
  3.5, 3.6, 3.7, 3.6, 3.7, 3.9, 3.2, // 9-15 daytime AC
  3.4, 3.8, 4.1, 3.9, 3.4, // 16-20 peak window
  2.6, 1.4, 0.8, // 21-23 wind-down
]

export function sampleElectricCsv(): string {
  if (cachedElectric) return cachedElectric
  const { days } = getDataset()
  const rnd = makeRng(11)

  // Expand each day's total across the hour shape with seeded jitter.
  const rows: { d: string; h: number; usage: number; rate: number; est: boolean }[] = []
  days.forEach((day, i) => {
    const quiet = i === 13 // Aug 7 — the household was away; near-baseline day
    const est = i === 23 // Aug 17 — estimated by PG&E
    const weights = HOUR_SHAPE.map((sv, h) => {
      if (quiet) return h < 6 || h >= 22 ? 0.42 : 0.55
      let w = sv * (0.9 + rnd() * 0.2)
      if (i === 9 && h >= 16 && h <= 21) w *= 1.5 // Aug 3 evening burst (AC + oven + laundry)
      return w
    })
    const sum = weights.reduce((a, b) => a + b, 0)
    const d = dateKey(day.dt)
    for (let h = 0; h < 24; h++) {
      rows.push({
        d,
        h,
        usage: (day.usage * weights[h]) / sum,
        rate: h >= PEAK_START && h <= PEAK_END ? PEAK_RATE : OFF_RATE,
        est,
      })
    }
  })

  // Scale costs so the period totals exactly $686.10.
  const rawCost = rows.reduce((a, r) => a + r.usage * r.rate, 0)
  const k = 686.10 / rawCost

  const lines = [
    'Name,SAMPLE HOME',
    'Address,"1607 Demo Lane, San Jose CA 95126"',
    'Account Number,XXXXXXXX1607',
    'Service,Sample residential electric',
    '',
    'TYPE,DATE,START TIME,END TIME,USAGE (kWh),COST,NOTES',
  ]
  const p = (x: number) => String(x).padStart(2, '0')
  for (const r of rows) {
    lines.push(
      `Electric usage,${r.d},${p(r.h)}:00,${p(r.h)}:59,${r.usage.toFixed(4)},$${(r.usage * r.rate * k).toFixed(4)},${r.est ? 'Estimated reading' : ''}`,
    )
  }
  cachedElectric = lines.join('\n')
  return cachedElectric
}

export function sampleGasCsv(): string {
  if (cachedGas) return cachedGas
  const { gdays } = getDataset()
  const lines = [
    'Name,SAMPLE HOME',
    'Address,"1607 Demo Lane, San Jose CA 95126"',
    'Account Number,XXXXXXXX1607',
    'Service,Sample residential gas',
    '',
    'TYPE,DATE,USAGE (therms),COST,NOTES',
  ]
  for (const d of gdays) {
    lines.push(`Natural gas usage,${dateKey(d.dt)},${d.usage.toFixed(4)},$${d.cost.toFixed(4)},`)
  }
  cachedGas = lines.join('\n')
  return cachedGas
}

let cachedUploads: { electric: ParsedUpload; gas: ParsedUpload } | null = null

export function sampleUploads(): { electric: ParsedUpload; gas: ParsedUpload } {
  if (!cachedUploads) {
    cachedUploads = {
      electric: parseGreenButtonCsv(sampleElectricCsv(), SAMPLE_ELECTRIC_NAME),
      gas: parseGreenButtonCsv(sampleGasCsv(), SAMPLE_GAS_NAME),
    }
  }
  return cachedUploads
}

/** Canned week of weather for the demo home (no real ZIP in demo mode). */
export const SAMPLE_FORECAST: ForecastDay[] = [
  { day: 'MON', hi: 84, lo: 61, code: 0 },
  { day: 'TUE', hi: 87, lo: 63, code: 0 },
  { day: 'WED', hi: 91, lo: 66, code: 2 },
  { day: 'THU', hi: 95, lo: 68, code: 0 },
  { day: 'FRI', hi: 97, lo: 70, code: 0 },
  { day: 'SAT', hi: 88, lo: 64, code: 2 },
  { day: 'SUN', hi: 82, lo: 60, code: 2 },
]

/** Demo billing cycle (matches the design's "Jul 24 – Aug 23" statement). */
export const SAMPLE_BILLING = { start: '2026-07-25', end: '2026-08-24' }
