// The AC playbook: a forecast-driven thermostat schedule anchored to the
// user's detected peak window. Setpoints come from comfort bands, not an
// optimizer — a temperature you'll actually keep beats the theoretical
// optimum. Requires no configuration beyond the optional ZIP.

import type { FuelAnalysis } from './analyze'
import { hourLabel, windowLabel } from './format'
import { median } from './stats'
import type { ForecastDay } from './weather'
import { weatherIcon } from './weather'
import type { Profile } from '../types'

export type Band = 'Off' | 'Standard' | 'Hot' | 'Extreme'

export interface PlanForecastDay {
  day: string
  hi: number
  lo: number
  icon: string
  band: Band
  bandColor: string
  iconColor: string
  bg: string
  border: string
}

export interface ScheduleBlock {
  period: string
  time: string
  /** Clock hours this block covers, on a day that runs 6am to 6am so the four
   *  blocks read left to right in schedule order. `to` may exceed 24. */
  fromHour: number
  toHour: number
  /** Setpoint in °F; the reader's unit is applied at render. null = AC off. */
  tempF: number | null
  why: string
  bg: string
  border: string
  labelColor: string
  tempColor: string
}

export interface AcPlan {
  hasAC: boolean
  windowLabel: string
  peakEndLabel: string
  schedule: ScheduleBlock[]
  summerChip: string | null
  todayLine: string
  forecast: PlanForecastDay[] | null
  /** Band edges in °F, plus the setpoints that band uses. */
  bands: {
    name: Band
    loF: number | null
    hiF: number | null
    preF: number | null
    peakF: number | null
    note: string
    count: string
    dot: string
  }[]
  /** delta is a temperature *difference* in °F, not an absolute reading. */
  nightFlush: { delta: number; openAt: string; closeBy: string } | null
  preCool: { time: string; tempF: number | null }
  peak: { label: string; tempF: number | null }
  todayBand: Band | null
  todayHiF: number | null
  /** Today's outdoor temperature hour by hour across the same 6am-to-6am window
   *  as the schedule, each hour tagged with the block it falls in. Null when no
   *  hourly forecast is available. */
  hourly: { hour: number; outF: number; setF: number | null; block: number }[] | null
}

export const BAND_COLOR: Record<Band, string> = {
  Standard: 'var(--fg-4)',
  Hot: 'rgb(255,133,115)',
  Extreme: 'rgb(255,69,56)',
  Off: 'rgb(41,149,255)',
}

export function bandOf(hi: number): Band {
  if (hi < 78) return 'Off'
  if (hi < 88) return 'Standard'
  if (hi <= 95) return 'Hot'
  return 'Extreme'
}

const BAND_TEMPS: Record<Band, { pre: number | null; peak: number | null }> = {
  Off: { pre: null, peak: null },
  Standard: { pre: 72, peak: 78 },
  Hot: { pre: 70, peak: 77 },
  Extreme: { pre: 70, peak: 76 },
}

export function buildAcPlan(
  elec: FuelAnalysis | null,
  profile: Profile | null,
  forecast: ForecastDay[] | null,
  precoolSummerEst: number | null,
  /** Outdoor °F per hour from midnight local today, as `getForecast` returns. */
  hoursF?: number[] | null,
): AcPlan {
  const hasAC = profile?.ac_type !== 'No AC'
  const startHour = elec?.tou?.startHour ?? 16
  const endHour = elec?.tou?.endHour ?? 20
  const winLabel = elec?.tou?.label ?? windowLabel(startHour, endHour + 1)
  const preHour = Math.max(0, startHour - 3)
  const peakEndLabel = hourLabel(endHour + 1)

  const days: PlanForecastDay[] | null = forecast
    ? forecast.map((f) => {
        const band = bandOf(f.hi)
        return {
          day: f.day,
          hi: f.hi,
          lo: f.lo,
          band,
          icon: weatherIcon(f.code, f.hi),
          bandColor: BAND_COLOR[band],
          iconColor:
            band === 'Extreme' ? 'rgb(255,69,56)' : band === 'Hot' ? 'rgb(255,133,115)' : 'var(--fg-3)',
          bg: band === 'Extreme' ? 'rgba(255,69,56,0.08)' : 'var(--bg-3)',
          border: band === 'Extreme' ? 'rgba(255,69,56,0.35)' : 'var(--bg-6)',
        }
      })
    : null

  const today = days?.[0] ?? null
  const todayBand: Band = today?.band ?? 'Standard'
  const temps = BAND_TEMPS[todayBand === 'Off' ? 'Standard' : todayBand]

  // The chart day runs 6am to 6am, so the blocks read left to right in the same
  // order as the cards. Boundaries are clamped to stay in order even if a peak
  // window sits somewhere unusual.
  const WAKE = 6
  const b1 = Math.min(Math.max(preHour, WAKE), WAKE + 24)
  const b2 = Math.min(Math.max(startHour, b1), WAKE + 24)
  const b3 = Math.min(Math.max(endHour + 1, b2), WAKE + 24)

  const schedule: ScheduleBlock[] = [
    {
      period: 'Wake',
      time: hourLabel(6),
      fromHour: WAKE,
      toHour: b1,
      tempF: 76,
      why: "Coast on last night's cool air.",
      bg: 'var(--bg-3)',
      border: 'var(--bg-6)',
      labelColor: 'var(--fg-4)',
      tempColor: 'var(--fg-0)',
    },
    {
      period: 'Pre-cool',
      time: hourLabel(preHour),
      fromHour: b1,
      toHour: b2,
      tempF: temps.pre,
      why: 'Chill the house while power is cheap.',
      bg: 'rgba(41,149,255,0.09)',
      border: 'rgba(41,149,255,0.3)',
      labelColor: 'rgb(41,149,255)',
      tempColor: 'rgb(41,149,255)',
    },
    {
      period: 'Peak',
      time: winLabel,
      fromHour: b2,
      toHour: b3,
      tempF: temps.peak,
      why: 'Keep the lid shut. The AC mostly rests.',
      bg: 'rgba(255,221,85,0.08)',
      border: 'rgba(255,221,85,0.3)',
      labelColor: 'rgb(255,221,85)',
      tempColor: 'var(--fg-0)',
    },
    {
      period: 'Evening',
      time: peakEndLabel,
      fromHour: b3,
      toHour: WAKE + 24,
      tempF: 74,
      why: 'Cheap power returns.',
      bg: 'var(--bg-3)',
      border: 'var(--bg-6)',
      labelColor: 'var(--fg-4)',
      tempColor: 'var(--fg-0)',
    },
  ]

  const count = (b: Band) => `${days ? days.filter((d) => d.band === b).length : 0} day${days && days.filter((d) => d.band === b).length === 1 ? '' : 's'}`
  const bands: AcPlan['bands'] = [
    { name: 'Off', loF: null, hiF: 78, preF: null, peakF: null, note: 'windows do the work', count: count('Off'), dot: BAND_COLOR.Off },
    { name: 'Standard', loF: 78, hiF: 88, preF: 72, peakF: 78, note: '', count: count('Standard'), dot: BAND_COLOR.Standard },
    { name: 'Hot', loF: 88, hiF: 95, preF: 70, peakF: 77, note: '', count: count('Hot'), dot: BAND_COLOR.Hot },
    { name: 'Extreme', loF: 95, hiF: null, preF: null, peakF: null, note: 'comfort first', count: count('Extreme'), dot: BAND_COLOR.Extreme },
  ]

  let nightFlush: AcPlan['nightFlush'] = null
  if (days) {
    const delta = Math.round(74 - median(days.map((d) => d.lo)))
    if (delta >= 5) {
      nightFlush = { delta, openAt: peakEndLabel, closeBy: '8 AM' }
    }
  }

  // Today's outdoor curve across the same window as the schedule, so the chart
  // sits directly under the cards it explains. Each hour carries the setpoint
  // in force at that hour, which is what makes the two readable together.
  let hourly: AcPlan['hourly'] = null
  if (hoursF && hoursF.length >= WAKE + 24) {
    const rows: NonNullable<AcPlan['hourly']> = []
    for (let h = WAKE; h < WAKE + 24; h++) {
      const outF = hoursF[h]
      if (!Number.isFinite(outF)) continue
      const block = schedule.findIndex((b) => h >= b.fromHour && h < b.toHour)
      const at = block >= 0 ? block : schedule.length - 1
      rows.push({ hour: h % 24, outF, setF: schedule[at]!.tempF, block: at })
    }
    if (rows.length) hourly = rows
  }

  return {
    hasAC,
    hourly,
    windowLabel: winLabel,
    peakEndLabel,
    schedule,
    summerChip:
      precoolSummerEst && precoolSummerEst >= 10 ? `~$${Math.round(precoolSummerEst)} this summer` : null,
    // Composed at render so the high can carry the reader's unit.
    todayLine: today ? `${todayBand} day` : `Detected peak ${winLabel}`,
    todayBand: today ? todayBand : null,
    todayHiF: today ? today.hi : null,
    forecast: days,
    bands,
    nightFlush,
    preCool: { time: `PRE-COOL · ${hourLabel(preHour)}`, tempF: temps.pre },
    peak: { label: `PEAK · ${winLabel}`, tempF: temps.peak },
  }
}
