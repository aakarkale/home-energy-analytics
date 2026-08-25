// Rate-plan analysis: everything Hearth can learn about *what you pay* from
// the cost column of an hourly export. Effective prices include all charges
// (that's what you actually pay), so they won't match a published tariff line
// item exactly. Two independent things set the price: the hour of day (the
// TOU window) and, on tiered plans, whether the billing cycle's baseline
// allowance has been used up — detected here as a persistent step in unit
// price partway through each cycle.

import type { ParsedUpload } from './parse'
import type { Tou } from './analyze'
import { median, quantile } from './stats'
import { addDays, dateFromKey } from './format'

export interface HourRow {
  h: number
  peak: boolean
  /** Median effective $/kWh in the below-allowance tier at this hour (null if unseen). */
  below: number | null
  /** Median effective $/kWh in the above-allowance tier at this hour. */
  above: number | null
  /** Blended effective rate = total cost / total kWh at this hour. */
  effective: number | null
  avgKwh: number
  totalCost: number
}

export interface AllowanceCrossing {
  cycleStart: string
  cycleEnd: string
  cycleDays: number
  daysPresent: number
  crossedAfterKwh: number
  onDay: number
}

export interface AllowanceAnalysis {
  perDayLow: number
  perDayHigh: number
  perCycleLow: number
  perCycleHigh: number
  crossings: AllowanceCrossing[]
  lastCycleKwh: number
  multipleLow: number
  multipleHigh: number
  /** Approximate $/cycle the allowance discount is worth at your rates. */
  cycleValue: number
  marginalOff: number | null
  marginalPeak: number | null
  /** Cumulative kWh by day for the most recent crossing's cycle (chart data). */
  cumulative: { day: number; date: string; kwh: number }[]
}

export interface RatesAnalysis {
  hasTiers: boolean
  offBelow: number | null
  offAbove: number | null
  peakBelow: number | null
  peakAbove: number | null
  /** $/kWh peak premium within each tier. */
  premiumBelow: number | null
  premiumAbove: number | null
  /** Percent step from below- to above-allowance within each window. */
  tierStepOffPct: number | null
  tierStepPeakPct: number | null
  hours: HourRow[]
  daysSpanned: number
  /** Hours ranked by total spend, descending. */
  topSpendHours: number[]
  /** Hours ranked by average kWh, descending. */
  heaviestHours: number[]
  /** The hour just before the peak steps up, vs the first peak hour. */
  cheaperNeighbor: {
    cheapHour: number
    dearHour: number
    cheapKwh: number
    dearKwh: number
    cheapCost: number
    dearCost: number
    savingPct: number
  } | null
  allowance: AllowanceAnalysis | null
}

interface Priced {
  d: string
  h: number
  usage: number
  cost: number
  price: number
}

/**
 * Split a window's unit prices into below/above tiers by the largest relative
 * gap in the sorted prices. A split only counts when the gap is a real step
 * (≥ $0.03 and ≥ 6% of the median) and both clusters carry weight.
 */
function splitTiers(prices: number[]): { threshold: number; below: number; above: number } | null {
  if (prices.length < 40) return null
  const s = [...prices].sort((a, b) => a - b)
  const lo = quantile(s, 0.02)
  const hi = quantile(s, 0.98)
  const med = median(s)
  if (hi - lo < Math.max(0.03, med * 0.06)) return null
  // Largest gap between consecutive prices, ignoring the extreme tails.
  const from = Math.floor(s.length * 0.1)
  const to = Math.ceil(s.length * 0.9)
  let gapAt = -1
  let gapSize = 0
  for (let i = from; i < to - 1; i++) {
    const g = s[i + 1] - s[i]
    if (g > gapSize) {
      gapSize = g
      gapAt = i
    }
  }
  if (gapAt < 0 || gapSize < Math.max(0.02, med * 0.04)) return null
  const threshold = (s[gapAt] + s[gapAt + 1]) / 2
  const belowXs = s.filter((p) => p < threshold)
  const aboveXs = s.filter((p) => p >= threshold)
  const share = belowXs.length / s.length
  if (share < 0.12 || share > 0.88) return null
  return { threshold, below: median(belowXs), above: median(aboveXs) }
}

export function buildRates(
  p: ParsedUpload,
  tou: Tou | undefined,
  billing: { start: string; end: string } | null,
): RatesAnalysis | null {
  if (p.granularity !== 'hourly') return null
  const priced: Priced[] = []
  for (const r of p.readings) {
    if (r.h === undefined || r.usage < 0.05 || r.cost <= 0) continue
    priced.push({ d: r.d, h: r.h, usage: r.usage, cost: r.cost, price: r.cost / r.usage })
  }
  if (priced.length < 100) return null

  const inPeak = (h: number) => !!tou && h >= tou.startHour && h <= tou.endHour
  const offSplit = splitTiers(priced.filter((x) => !inPeak(x.h)).map((x) => x.price))
  const peakSplit = tou ? splitTiers(priced.filter((x) => inPeak(x.h)).map((x) => x.price)) : null
  const hasTiers = !!(offSplit || peakSplit)

  const offPrices = priced.filter((x) => !inPeak(x.h)).map((x) => x.price)
  const peakPrices = priced.filter((x) => inPeak(x.h)).map((x) => x.price)
  const offBelow = offSplit ? offSplit.below : offPrices.length ? median(offPrices) : null
  const offAbove = offSplit ? offSplit.above : null
  const peakBelow = peakSplit ? peakSplit.below : peakPrices.length ? median(peakPrices) : null
  const peakAbove = peakSplit ? peakSplit.above : null

  const tierOf = (x: Priced): 'below' | 'above' | null => {
    const split = inPeak(x.h) ? peakSplit : offSplit
    if (!split) return null
    return x.price < split.threshold ? 'below' : 'above'
  }

  // Hour-by-hour table.
  const daySet = new Set(priced.map((x) => x.d))
  const daysSpanned = daySet.size
  const hours: HourRow[] = []
  for (let h = 0; h < 24; h++) {
    const xs = priced.filter((x) => x.h === h)
    const belowXs = xs.filter((x) => tierOf(x) === 'below').map((x) => x.price)
    const aboveXs = xs.filter((x) => tierOf(x) === 'above').map((x) => x.price)
    const totalKwh = xs.reduce((a, x) => a + x.usage, 0)
    const totalCost = xs.reduce((a, x) => a + x.cost, 0)
    hours.push({
      h,
      peak: inPeak(h),
      below: belowXs.length ? median(belowXs) : hasTiers ? null : xs.length ? median(xs.map((x) => x.price)) : null,
      above: aboveXs.length ? median(aboveXs) : null,
      effective: totalKwh > 0 ? totalCost / totalKwh : null,
      avgKwh: daysSpanned ? totalKwh / daysSpanned : 0,
      totalCost,
    })
  }

  const topSpendHours = [...hours].sort((a, b) => b.totalCost - a.totalCost).map((r) => r.h)
  const heaviestHours = [...hours].sort((a, b) => b.avgKwh - a.avgKwh).map((r) => r.h)

  let cheaperNeighbor: RatesAnalysis['cheaperNeighbor'] = null
  if (tou && tou.startHour > 0) {
    const cheap = hours[tou.startHour - 1]
    const dear = hours[tou.startHour]
    if (cheap.effective && dear.effective && dear.effective > cheap.effective) {
      cheaperNeighbor = {
        cheapHour: cheap.h,
        dearHour: dear.h,
        cheapKwh: cheap.avgKwh,
        dearKwh: dear.avgKwh,
        cheapCost: cheap.totalCost,
        dearCost: dear.totalCost,
        savingPct: Math.round((1 - cheap.effective / dear.effective) * 100),
      }
    }
  }

  // Allowance: walk each billing-cycle window; the day the above-tier share
  // takes over is the crossing, and cumulative kWh up to then estimates the
  // cycle's baseline allowance.
  let allowance: AllowanceAnalysis | null = null
  if (hasTiers && billing) {
    const cycleLen =
      Math.round((dateFromKey(billing.end).getTime() - dateFromKey(billing.start).getTime()) / 86400000) + 1
    if (cycleLen >= 20 && cycleLen <= 40) {
      // Enumerate cycle windows covering the data range.
      let start = billing.start
      while (start > p.periodStart) start = addDays(start, -cycleLen)
      const byDay = new Map<string, Priced[]>()
      for (const x of priced) {
        const xs = byDay.get(x.d) ?? []
        xs.push(x)
        byDay.set(x.d, xs)
      }
      const crossings: AllowanceCrossing[] = []
      let bestCumulative: AllowanceAnalysis['cumulative'] = []
      let lastCycleKwh = 0
      for (let cs = start; cs <= p.periodEnd; cs = addDays(cs, cycleLen)) {
        const ce = addDays(cs, cycleLen - 1)
        let cum = 0
        let crossed: { kwh: number; onDay: number } | null = null
        let daysPresent = 0
        const cumulative: AllowanceAnalysis['cumulative'] = []
        for (let i = 0; i < cycleLen; i++) {
          const d = addDays(cs, i)
          const xs = byDay.get(d)
          if (!xs || xs.length < 12) continue
          daysPresent++
          const aboveShare = xs.filter((x) => tierOf(x) === 'above').length / xs.length
          if (!crossed && aboveShare >= 0.5 && cum > 0) crossed = { kwh: cum, onDay: i + 1 }
          cum += xs.reduce((a, x) => a + x.usage, 0)
          cumulative.push({ day: i + 1, date: d, kwh: cum })
        }
        if (daysPresent >= cycleLen * 0.8) lastCycleKwh = cum
        if (crossed && daysPresent >= cycleLen * 0.5) {
          crossings.push({
            cycleStart: cs,
            cycleEnd: ce,
            cycleDays: cycleLen,
            daysPresent,
            crossedAfterKwh: crossed.kwh,
            onDay: crossed.onDay,
          })
          bestCumulative = cumulative
        }
      }
      if (crossings.length) {
        const kwhs = crossings.map((c) => c.crossedAfterKwh)
        const perCycleLow = Math.min(...kwhs)
        const perCycleHigh = Math.max(...kwhs)
        const peakKwhShare =
          priced.filter((x) => inPeak(x.h)).reduce((a, x) => a + x.usage, 0) /
          priced.reduce((a, x) => a + x.usage, 0)
        const diffOff = offSplit ? offSplit.above - offSplit.below : 0
        const diffPeak = peakSplit ? peakSplit.above - peakSplit.below : diffOff
        const blendedDiff = (1 - peakKwhShare) * diffOff + peakKwhShare * diffPeak
        const mid = (perCycleLow + perCycleHigh) / 2
        allowance = {
          perDayLow: perCycleLow / cycleLen,
          perDayHigh: perCycleHigh / cycleLen,
          perCycleLow,
          perCycleHigh,
          crossings,
          lastCycleKwh,
          multipleLow: mid > 0 && lastCycleKwh > 0 ? lastCycleKwh / perCycleHigh : 0,
          multipleHigh: mid > 0 && lastCycleKwh > 0 ? lastCycleKwh / perCycleLow : 0,
          cycleValue: mid * blendedDiff,
          marginalOff: offAbove,
          marginalPeak: peakAbove,
          cumulative: bestCumulative,
        }
      }
    }
  }

  return {
    hasTiers,
    offBelow,
    offAbove,
    peakBelow,
    peakAbove,
    premiumBelow: peakBelow !== null && offBelow !== null ? peakBelow - offBelow : null,
    premiumAbove: peakAbove !== null && offAbove !== null ? peakAbove - offAbove : null,
    tierStepOffPct:
      offSplit && offSplit.below > 0 ? Math.round((offSplit.above / offSplit.below - 1) * 100) : null,
    tierStepPeakPct:
      peakSplit && peakSplit.below > 0 ? Math.round((peakSplit.above / peakSplit.below - 1) * 100) : null,
    hours,
    daysSpanned,
    topSpendHours,
    heaviestHours,
    cheaperNeighbor,
    allowance,
  }
}
