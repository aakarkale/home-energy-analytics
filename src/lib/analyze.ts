// The analysis engine: turns parsed readings into everything the dashboard
// shows. Robust statistics only (median/MAD) — utility data is heavy-tailed
// and mean/σ baselines get dragged around by the spikes we want to catch.
// The peak window and rates are inferred from the user's own cost column, so
// no rate-plan configuration is ever needed.

import { mad, mean, median, quantile } from './stats'
import type { ParsedUpload, Reading } from './parse'
import {
  dowOf,
  fmtDayShort,
  fmtMonthDay,
  fmtNum,
  hourLabel,
  rangeLabel,
  weekdayName,
  windowLabel,
} from './format'
import type { Fuel } from '../types'

export interface DayPoint {
  d: string
  dow: number
  usage: number
  cost: number
  est?: boolean
}

export interface Tou {
  startHour: number
  /** inclusive last peak hour (design's "4–9 PM" is hours 16–20 billed, ends at 21:00) */
  endHour: number
  label: string
  peakRate: number
  offRate: number
  premiumPct: number
  peakCost: number
  offCost: number
  peakCostShare: number
  peakKwhPerDay: number
}

export interface EnergyEvent {
  id: string
  date: string
  sev: 'high' | 'med' | 'low'
  type: 'Spike' | 'Quiet day' | 'Estimated'
  title: string
  cost: string
  detail: string
  tip: string
}

export interface FuelAnalysis {
  fuel: Fuel
  unit: 'kWh' | 'therms'
  granularity: 'hourly' | 'daily'
  daily: DayPoint[]
  days: number
  totalUsage: number
  totalCost: number
  avgUsage: number
  avgCost: number
  rangeLabel: string
  periodStart: string
  periodEnd: string
  /** kWh per hour drawn around the clock (hourly electric only). */
  alwaysOn?: { kwhPerHr: number; monthlyCost: number }
  tou?: Tou
  hourlyProfile?: { mean: number[]; p25: number[]; p75: number[] }
  /** Last ≤14 days × 24 raw hourly values, for the heatmap. */
  heat?: { rows: { d: string; label: string; values: number[] }[]; scale: number; spikeCells: Set<string> }
  dowAvg: number[]
  weekendDeltaPct: number
  events: EnergyEvent[]
  projection?: { projected: number; dayN: number; cycleDays: number }
  activeGas?: {
    days: number
    of: number
    avgWhenOn: number
    idleDays: number
    activeThr: number
    idleThr: number
  }
  /** Sharpest single hourly reading (excluding estimated days). */
  sharpest?: { date: string; hour: number; kwh: number; ratio: number }
  quietest?: { date: string; belowPct: number }
  gasSpike?: { date: string; therms: number; ratio: number }
}

export function rollupDaily(readings: Reading[]): DayPoint[] {
  const byDay = new Map<string, DayPoint>()
  for (const r of readings) {
    let p = byDay.get(r.d)
    if (!p) {
      p = { d: r.d, dow: dowOf(r.d), usage: 0, cost: 0 }
      byDay.set(r.d, p)
    }
    p.usage += r.usage
    p.cost += r.cost
    if (r.est) p.est = true
  }
  return [...byDay.values()].sort((a, b) => (a.d < b.d ? -1 : 1))
}

function detectTou(readings: Reading[], days: number): Tou | undefined {
  // Median unit price per hour-of-day, from the user's own cost column.
  const byHour: number[][] = Array.from({ length: 24 }, () => [])
  for (const r of readings) {
    if (r.h === undefined || r.usage < 0.05 || r.cost <= 0) continue
    byHour[r.h].push(r.cost / r.usage)
  }
  const unit = byHour.map((xs) => (xs.length >= 3 ? median(xs) : NaN))
  const known = unit.filter((v) => Number.isFinite(v))
  if (known.length < 12) return undefined
  const lo = Math.min(...known)
  const hi = Math.max(...known)
  if (hi - lo < 0.03) return undefined // flat rate

  const thresh = lo + 0.5 * (hi - lo)
  // Longest contiguous run of expensive hours (PG&E peaks are afternoon/evening).
  let best: [number, number] | null = null
  let runStart = -1
  for (let h = 0; h <= 24; h++) {
    const isPeak = h < 24 && Number.isFinite(unit[h]) && unit[h] >= thresh
    if (isPeak && runStart < 0) runStart = h
    if (!isPeak && runStart >= 0) {
      if (!best || h - runStart > best[1] - best[0]) best = [runStart, h - 1]
      runStart = -1
    }
  }
  if (!best || best[1] - best[0] < 1) return undefined
  const [s, e] = best

  const inWin = (h: number) => h >= s && h <= e
  const peakRate = median(readings.filter((r) => r.h !== undefined && inWin(r.h) && r.usage >= 0.05 && r.cost > 0).map((r) => r.cost / r.usage))
  const offRate = median(readings.filter((r) => r.h !== undefined && !inWin(r.h) && r.usage >= 0.05 && r.cost > 0).map((r) => r.cost / r.usage))
  if (!peakRate || !offRate || peakRate <= offRate) return undefined

  let peakCost = 0
  let offCost = 0
  let peakKwh = 0
  for (const r of readings) {
    if (r.h === undefined) continue
    if (inWin(r.h)) {
      peakCost += r.cost
      peakKwh += r.usage
    } else offCost += r.cost
  }
  const total = peakCost + offCost
  return {
    startHour: s,
    endHour: e,
    label: windowLabel(s, e + 1),
    peakRate,
    offRate,
    premiumPct: Math.round((peakRate / offRate - 1) * 100),
    peakCost,
    offCost,
    peakCostShare: total ? peakCost / total : 0,
    peakKwhPerDay: days ? peakKwh / days : 0,
  }
}

function detectAlwaysOn(readings: Reading[]): number {
  // Per day, the mean of the 3 lowest hours; the median of those across days
  // is a robust standby estimate.
  const byDay = new Map<string, number[]>()
  for (const r of readings) {
    if (r.h === undefined) continue
    const xs = byDay.get(r.d) ?? []
    xs.push(r.usage)
    byDay.set(r.d, xs)
  }
  const mins: number[] = []
  for (const xs of byDay.values()) {
    if (xs.length < 20) continue // ignore partial days
    const s = [...xs].sort((a, b) => a - b)
    mins.push(mean(s.slice(0, 3)))
  }
  return mins.length ? median(mins) : 0
}

interface EventCopy {
  sevRank: Record<'high' | 'med' | 'low', number>
}
const SEV_RANK: EventCopy['sevRank'] = { high: 0, med: 1, low: 2 }

function detectEvents(a: FuelAnalysis, readings: Reading[]): EnergyEvent[] {
  const events: EnergyEvent[] = []
  const elec = a.fuel === 'electric'
  const unit = a.unit
  // Estimated days are excluded from spike detection so they never trigger
  // false alarms — they get their own low-severity note instead. Gas usage is
  // intermittent (many near-zero days), so its baseline uses active days only.
  const measured = a.daily.filter((p) => !p.est)
  const activeThr = a.activeGas?.activeThr ?? 0.3
  const baseline = elec ? measured : measured.filter((p) => p.usage >= activeThr)
  const med = median(baseline.map((p) => p.usage))
  const dev = mad(baseline.map((p) => p.usage)) || med * 0.15 || 1
  const medCost = median(baseline.map((p) => p.cost))

  // Evening spikes inside the peak window (hourly electric only): flag days
  // whose peak-window total runs far above the typical evening.
  const eveningDates = new Set<string>()
  if (a.tou && a.granularity === 'hourly') {
    const { startHour, endHour } = a.tou
    const evByDay = new Map<string, { kwh: number; cost: number }>()
    for (const r of readings) {
      if (r.h === undefined || r.h < startHour || r.h > endHour) continue
      const e = evByDay.get(r.d) ?? { kwh: 0, cost: 0 }
      e.kwh += r.usage
      e.cost += r.cost
      evByDay.set(r.d, e)
    }
    const vals = [...evByDay.entries()].filter(([d]) => !a.daily.find((p) => p.d === d)?.est)
    const evMed = median(vals.map(([, e]) => e.kwh))
    const evDev = mad(vals.map(([, e]) => e.kwh)) || evMed * 0.2 || 1
    const evMedCost = median(vals.map(([, e]) => e.cost))
    for (const [d, e] of vals) {
      const ratio = evMed ? e.kwh / evMed : 0
      if (e.kwh > evMed + 3 * evDev && ratio >= 1.8) {
        eveningDates.add(d)
        const hours = endHour - startHour + 1
        events.push({
          id: `${a.fuel}:evening:${d}`,
          date: d,
          sev: 'high',
          type: 'Spike',
          title: `Evening spike · ${fmtDayShort(d)}`,
          cost: `+$${(e.cost - evMedCost).toFixed(2)}`,
          detail: `${a.tou.label} ran ${ratio.toFixed(1)}× your usual evening: ${e.kwh.toFixed(1)} ${unit} in ${hours} hours, right inside the peak window.`,
          tip: `If this was laundry or oven + AC together, staggering them past ${hourLabel(endHour + 1)} would have cost ${a.tou.premiumPct}% less.`,
        })
      }
    }
  }

  for (const p of measured) {
    if (eveningDates.has(p.d)) continue
    const ratio = med ? p.usage / med : 0
    if (p.usage > med + 2.5 * dev && ratio >= (elec ? 1.4 : 1.6)) {
      const abovePct = Math.round((ratio - 1) * 100)
      if (elec) {
        events.push({
          id: `${a.fuel}:high:${p.d}`,
          date: p.d,
          sev: p.usage > med + 4 * dev ? 'high' : 'med',
          type: 'Spike',
          title: `High day · ${fmtDayShort(p.d)}`,
          cost: `+$${Math.max(0, p.cost - medCost).toFixed(2)}`,
          detail: `${fmtNum(p.usage, 0)} ${unit}, ${abovePct}% above a typical ${weekdayName(p.d)}. Spread across the whole day rather than one hour.`,
          tip: 'Whole-day highs usually mean AC on a hot day. Check the playbook pre-cool for days like this.',
        })
      } else {
        events.push({
          id: `${a.fuel}:high:${p.d}`,
          date: p.d,
          sev: 'med',
          type: 'Spike',
          title: `High gas day · ${fmtDayShort(p.d)}`,
          cost: `+$${Math.max(0, p.cost - medCost).toFixed(2)}`,
          detail: `${p.usage.toFixed(1)} therms, about ${ratio >= 1.75 && ratio <= 2.5 ? 'double' : ratio.toFixed(1) + '×'} a normal active day.`,
          tip: 'One-off gas highs are usually hot water: guests, laundry, long showers.',
        })
      }
    } else if (elec && p.usage < med - 2.5 * dev && p.usage > 0 && ratio <= 0.7) {
      const belowPct = Math.round((1 - ratio) * 100)
      events.push({
        id: `${a.fuel}:quiet:${p.d}`,
        date: p.d,
        sev: 'low',
        type: 'Quiet day',
        title: `Quiet day · ${fmtDayShort(p.d)}`,
        cost: `−$${Math.max(0, medCost - p.cost).toFixed(2)}`,
        detail: `${fmtNum(p.usage, 0)} ${unit}, ${belowPct}% below normal. This is close to your true always-on baseline.`,
        tip: 'Days like this are gold: mark "I was away" and we measure your phantom load precisely.',
      })
    }
  }

  for (const p of a.daily) {
    if (p.est) {
      events.push({
        id: `${a.fuel}:est:${p.d}`,
        date: p.d,
        sev: 'low',
        type: 'Estimated',
        title: `Estimated reading · ${fmtMonthDay(p.d)}`,
        cost: '—',
        detail: 'PG&E flagged this day as estimated, not measured. Treat its numbers loosely.',
        tip: 'Estimated days are excluded from spike detection so they never trigger false alarms.',
      })
    }
  }

  // Gas: a healthy run of near-zero days is worth calling out.
  if (!elec) {
    const idleThr = a.activeGas?.idleThr ?? 0.15
    let runStart = -1
    let bestRun: [number, number] | null = null
    for (let i = 0; i <= a.daily.length; i++) {
      const nearZero = i < a.daily.length && a.daily[i].usage < idleThr
      if (nearZero && runStart < 0) runStart = i
      if (!nearZero && runStart >= 0) {
        if (!bestRun || i - runStart > bestRun[1] - bestRun[0]) bestRun = [runStart, i - 1]
        runStart = -1
      }
    }
    if (bestRun && bestRun[1] - bestRun[0] + 1 >= 7) {
      const [s, e] = bestRun
      events.push({
        id: `${a.fuel}:quietrun:${a.daily[s].d}`,
        date: a.daily[s].d,
        sev: 'low',
        type: 'Quiet day',
        title: `${e - s + 1} near-zero days in a row`,
        cost: '—',
        detail: `${fmtMonthDay(a.daily[s].d)}–${fmtMonthDay(a.daily[e].d)} used almost no gas: heating off, minimal hot water.`,
        tip: 'A healthy summer pattern. If winter shows this, check the pilot light.',
      })
    }
  }

  events.sort((x, y) => SEV_RANK[x.sev] - SEV_RANK[y.sev] || (x.date < y.date ? -1 : 1))
  return events.slice(0, 6)
}

export function analyzeFuel(
  p: ParsedUpload,
  billing?: { start: string; end: string } | null,
): FuelAnalysis {
  const daily = rollupDaily(p.readings)
  const days = daily.length
  const totalUsage = p.totalUsage
  const totalCost = p.totalCost

  const a: FuelAnalysis = {
    fuel: p.fuel,
    unit: p.unit,
    granularity: p.granularity,
    daily,
    days,
    totalUsage,
    totalCost,
    avgUsage: days ? totalUsage / days : 0,
    avgCost: days ? totalCost / days : 0,
    rangeLabel: rangeLabel(p.periodStart, p.periodEnd, days),
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    dowAvg: [],
    weekendDeltaPct: 0,
    events: [],
  }

  if (p.granularity === 'hourly') {
    a.tou = detectTou(p.readings, days)
    const kwhPerHr = detectAlwaysOn(p.readings)
    if (kwhPerHr > 0) {
      const rate = a.tou?.offRate ?? (totalUsage ? totalCost / totalUsage : 0)
      a.alwaysOn = { kwhPerHr, monthlyCost: kwhPerHr * 24 * 30 * rate }
    }

    // Hourly profile with a typical band.
    const byHour: number[][] = Array.from({ length: 24 }, () => [])
    for (const r of p.readings) if (r.h !== undefined) byHour[r.h].push(r.usage)
    a.hourlyProfile = {
      mean: byHour.map((xs) => mean(xs)),
      p25: byHour.map((xs) => quantile(xs, 0.25)),
      p75: byHour.map((xs) => quantile(xs, 0.75)),
    }

    // Sharpest single reading (excluding estimated days).
    const estDays = new Set(daily.filter((d) => d.est).map((d) => d.d))
    const hourlyMed = median(p.readings.filter((r) => r.h !== undefined).map((r) => r.usage))
    let sharp: Reading | null = null
    for (const r of p.readings) {
      if (r.h === undefined || estDays.has(r.d)) continue
      if (!sharp || r.usage > sharp.usage) sharp = r
    }
    if (sharp && hourlyMed > 0 && sharp.usage / hourlyMed >= 2) {
      a.sharpest = {
        date: sharp.d,
        hour: sharp.h!,
        kwh: sharp.usage,
        ratio: sharp.usage / hourlyMed,
      }
    }

    // Heatmap: last ≤14 days × 24 raw values.
    const heatDays = daily.slice(-14)
    const valuesByDay = new Map<string, number[]>()
    for (const d of heatDays) valuesByDay.set(d.d, Array.from({ length: 24 }, () => 0))
    for (const r of p.readings) {
      if (r.h === undefined) continue
      const row = valuesByDay.get(r.d)
      if (row) row[r.h] += r.usage
    }
    const all = [...valuesByDay.values()].flat()
    a.heat = {
      rows: heatDays.map((d) => ({
        d: d.d,
        label: dateFromLabel(d.d),
        values: valuesByDay.get(d.d)!,
      })),
      scale: Math.max(quantile(all, 0.95), 0.1),
      spikeCells: new Set(),
    }
  }

  // Day-of-week averages.
  const dowSum = [0, 0, 0, 0, 0, 0, 0]
  const dowN = [0, 0, 0, 0, 0, 0, 0]
  for (const d of daily) {
    dowSum[d.dow] += d.usage
    dowN[d.dow]++
  }
  a.dowAvg = dowSum.map((v, i) => v / (dowN[i] || 1))
  const wk = (a.dowAvg[0] + a.dowAvg[6]) / 2
  const wd = a.dowAvg.slice(1, 6).reduce((x, y) => x + y, 0) / 5
  a.weekendDeltaPct = wd ? Math.round((wk / wd - 1) * 100) : 0

  if (p.fuel === 'gas') {
    // Gas is bimodal (water-heater days vs idle days); the active threshold
    // adapts to the home rather than assuming a fixed cutoff.
    const usages = daily.map((d) => d.usage)
    const activeThr = Math.max(0.3, 0.5 * quantile(usages, 0.85))
    const idleThr = Math.max(0.15, 0.3 * activeThr)
    const active = daily.filter((d) => d.usage >= activeThr)
    a.activeGas = {
      days: active.length,
      of: days,
      avgWhenOn: active.length ? mean(active.map((d) => d.usage)) : 0,
      idleDays: daily.filter((d) => d.usage < idleThr).length,
      activeThr,
      idleThr,
    }
    const activeMed = median(active.map((d) => d.usage))
    let top: DayPoint | null = null
    for (const d of daily) if (!top || d.usage > top.usage) top = d
    if (top && activeMed > 0 && top.usage / activeMed >= 1.6) {
      a.gasSpike = { date: top.d, therms: top.usage, ratio: top.usage / activeMed }
    }
  }

  // Quietest measured day.
  const measured = daily.filter((d) => !d.est && d.usage > 0)
  const medU = median(measured.map((d) => d.usage))
  let quiet: DayPoint | null = null
  for (const d of measured) if (!quiet || d.usage < quiet.usage) quiet = d
  if (quiet && medU > 0 && quiet.usage / medU <= 0.6) {
    a.quietest = { date: quiet.d, belowPct: Math.round((1 - quiet.usage / medU) * 100) }
  }

  a.events = detectEvents(a, p.readings)

  // Mark heatmap spike cells from evening-spike events.
  if (a.heat && a.tou) {
    for (const ev of a.events) {
      if (ev.id.includes(':evening:')) {
        for (let h = a.tou.startHour; h <= a.tou.endHour; h++) a.heat.spikeCells.add(`${ev.date}#${h}`)
      }
    }
  }

  // Bill projection for the cycle containing the last reading.
  const cycle = billing ?? { start: p.periodStart, end: p.periodEnd }
  if (cycle.start <= p.periodEnd) {
    const inCycle = daily.filter((d) => d.d >= cycle.start && d.d <= cycle.end)
    if (inCycle.length) {
      const cycleDays =
        Math.round(
          (dateFromKeyMs(cycle.end) - dateFromKeyMs(cycle.start)) / 86400000,
        ) + 1
      const dayN = inCycle.length
      const spent = inCycle.reduce((x, d) => x + d.cost, 0)
      const recent = daily.slice(-14).map((d) => d.cost)
      const projected = spent + Math.max(0, cycleDays - dayN) * median(recent)
      a.projection = { projected, dayN, cycleDays }
    }
  }

  return a
}

function dateFromKeyMs(d: string): number {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).getTime()
}

function dateFromLabel(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  // Weekday plus the numeric date in the platform's mm/dd order.
  const wd = new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short' })
  const p2 = (x: number) => String(x).padStart(2, '0')
  return `${wd} ${p2(m)}/${p2(day)}`
}
