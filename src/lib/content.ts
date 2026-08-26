// Insight, savings and diagnostic-question generation. Everything is derived
// from the analysis of the user's own data plus the few home facts collected
// in onboarding — each collected fact changes what gets asked or suggested,
// so nothing irrelevant is ever requested.

import type { DayPoint, FuelAnalysis } from './analyze'
import { quantile } from './stats'
import { fmtDayShort, fmtMoney0, fmtMonthDay, hourLabel } from './format'
import type { EvMetaEntry, Fuel, Profile } from '../types'

/** Diagnostic answers, keyed `${fuel}:${questionId}` exactly as the store holds them. */
export type AnswerMap = Record<string, string[]>

function ans(answers: AnswerMap | undefined, fuel: Fuel, id: string): string[] {
  return answers?.[`${fuel}:${id}`] ?? []
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x))

// What share of the standby baseline a named always-on device realistically
// gives back. A fridge has to run; a desktop left on overnight does not.
const STANDBY_TRIM: Record<string, number> = {
  Fridge: 0,
  'Wi-Fi & modem': 0.02,
  'Desktop PC': 0.35,
  'Fish tank': 0.05,
  'Security cameras': 0.05,
  'Pool pump': 0.4,
}

// How much of a load running in the peak window can move out of it. Dinner is
// dinner; laundry and an EV can wait.
const PEAK_MOVABLE: Record<string, number> = {
  Laundry: 0.9,
  EV: 0.95,
  'EV charging': 0.95,
  Dishwasher: 0.9,
  AC: 0.35,
  Cooking: 0.1,
  'TV & gaming': 0.05,
  Oven: 0.15,
}

/** Something the user named that we have no weight for. Assume middling. */
const UNKNOWN_TRIM = 0.1
const UNKNOWN_MOVABLE = 0.3

export interface Insight {
  icon: string
  color: string
  title: string
  chip: string
  body: string
}

export interface SavingItem {
  label: string
  amt: string
  w: string
  /** How the figure was derived, revealed on hover/focus. */
  note: string
}

export interface QDef {
  id: string
  tag: string
  money: string
  text: string
  multi?: boolean
  opts: string[]
}

interface SavingEst {
  label: string
  perYr: number
  note: string
}

function homeNoun(profile: Profile | null): string {
  switch (profile?.home_type) {
    case 'House':
      return 'a house your size'
    case 'Townhouse':
      return 'a townhouse your size'
    case 'Apartment / condo':
      return 'an apartment your size'
    default:
      return 'a home your size'
  }
}

function estimateSavings(
  a: FuelAnalysis,
  profile: Profile | null,
  answers?: AnswerMap,
  evMeta?: Record<string, EvMetaEntry>,
): SavingEst[] {
  const ests: SavingEst[] = []
  const hasAC = profile?.ac_type !== 'No AC'
  if (a.fuel === 'electric') {
    const rate = a.totalUsage ? a.totalCost / a.totalUsage : 0
    const atPeak = ans(answers, 'electric', 'peak')
    if (a.tou) {
      const premium = a.tou.peakRate - a.tou.offRate
      // Without answers, assume ~40% of peak-window load is movable. Once the
      // user names what actually runs then, average those loads instead: an
      // evening of laundry is nearly all movable, an evening of cooking is not.
      const movable = atPeak.length
        ? clamp(
            atPeak.reduce((x, o) => x + (PEAK_MOVABLE[o] ?? UNKNOWN_MOVABLE), 0) / atPeak.length,
            0.05,
            0.9,
          )
        : 0.4
      ests.push({
        label: `Shift flexible loads off ${a.tou.label}`,
        perYr: movable * a.tou.peakKwhPerDay * premium * 365,
        note: atPeak.length
          ? `${Math.round(movable * 100)}% of your ${a.tou.peakKwhPerDay.toFixed(1)} kWh average peak load, weighted by what you said runs then (${atPeak.join(', ')}), at the $${premium.toFixed(2)}/kWh premium your bill shows.`
          : `40% of your ${a.tou.peakKwhPerDay.toFixed(1)} kWh average peak load moved off-peak, at the $${premium.toFixed(2)}/kWh premium your bill shows. Tell us what runs at peak in Activity to sharpen this.`,
      })
      // If they listed what runs at peak and AC was not on it, pre-cooling has
      // nothing to pre-empt.
      const acAtPeak = !atPeak.length || atPeak.includes('AC')
      if (hasAC && acAtPeak && a.granularity === 'hourly') {
        // Cooling load ≈ hot-day minus mild-day delta — never a flat share of
        // the bill. ~30% of it can move to pre-peak hours over ~120 warm days.
        const usage = a.daily.filter((d) => !d.est).map((d) => d.usage)
        const hot = usage.filter((u) => u >= quantile(usage, 0.75))
        const mild = usage.filter((u) => u <= quantile(usage, 0.25))
        const coolingDelta = Math.max(
          0,
          hot.reduce((x, y) => x + y, 0) / (hot.length || 1) -
            mild.reduce((x, y) => x + y, 0) / (mild.length || 1),
        )
        ests.push({
          label: 'Pre-cool before the peak',
          perYr: 0.3 * coolingDelta * premium * 120,
          note: `30% of your ${coolingDelta.toFixed(1)} kWh hot-day cooling load shifted, over ~120 warm days.`,
        })
      }
    }
    if (a.alwaysOn) {
      const offRate = a.tou?.offRate ?? rate
      const named = ans(answers, 'electric', 'always-on')

      // A day the user marked "I was away" is a direct reading of standby:
      // nothing discretionary ran. Answering "Away all day" on the quiet-day
      // question says the same about the day the engine flagged. Collect both.
      const awayDates = new Set<string>()
      for (const [k, v] of Object.entries(evMeta ?? {})) {
        const sep = k.indexOf(':')
        if (sep > 0 && k.slice(0, sep) === 'electric' && v.away) awayDates.add(k.slice(sep + 1))
      }
      if (ans(answers, 'electric', 'dip').includes('Away all day') && a.quietest) {
        awayDates.add(a.quietest.date)
      }

      // Take the lowest such day. It can tighten the standby figure, never
      // inflate it: `quietest` is only the lowest day relative to normal, and
      // even a real away day reads high if something stayed on. The detector
      // already floors at the overnight minima, so believe a marked day only
      // when it comes in under that.
      let awayDay: DayPoint | undefined
      let measured = Infinity
      for (const d of a.daily) {
        if (d.est || !awayDates.has(d.d)) continue
        const perHr = d.usage / 24
        if (perHr < measured) {
          measured = perHr
          awayDay = d
        }
      }
      const checked = awayDay
      if (measured >= a.alwaysOn.kwhPerHr) awayDay = undefined
      const baseline = awayDay ? measured : a.alwaysOn.kwhPerHr

      // Unanswered, assume ~15% of standby is avoidable. Named devices give a
      // real figure: a fridge returns nothing, a desktop left on returns a lot.
      let share = 0.15
      let basis = `15% of your ${baseline.toFixed(2)} kWh/hr standby baseline, priced at the off-peak rate. Tell us what runs around the clock in Activity to sharpen this.`
      if (named.length) {
        share = clamp(
          named.reduce((x, o) => x + (STANDBY_TRIM[o] ?? UNKNOWN_TRIM), 0),
          0.02,
          0.5,
        )
        const lead = [...named].sort(
          (x, y) => (STANDBY_TRIM[y] ?? UNKNOWN_TRIM) - (STANDBY_TRIM[x] ?? UNKNOWN_TRIM),
        )[0]!
        const leadTrim = STANDBY_TRIM[lead] ?? UNKNOWN_TRIM
        basis =
          leadTrim <= 0.02
            ? `${Math.round(share * 100)}% of your ${baseline.toFixed(2)} kWh/hr baseline. You named only things that have to stay on, so there is little here to reclaim.`
            : `${Math.round(share * 100)}% of your ${baseline.toFixed(2)} kWh/hr baseline, from the ${named.length} always-on ${named.length === 1 ? 'device' : 'devices'} you named. ${lead} has the most headroom.`
      }
      // Say what we did with the away marks either way. Adopting a reading that
      // came in higher would inflate the estimate, so we keep the tighter one,
      // but silently ignoring the input is what makes it feel unheard.
      if (awayDay) {
        basis += ` Baseline measured on ${fmtMonthDay(awayDay.d)}, a day you confirmed you were away.`
      } else if (checked) {
        basis += ` Checked against ${fmtMonthDay(checked.d)}, a day you marked away: it ran ${(checked.usage / 24).toFixed(2)} kWh/hr, above your overnight reading, so we kept the tighter one.`
      }
      ests.push({
        label: 'Trim always-on phantom load',
        perYr: share * baseline * 24 * 365 * offRate,
        note: basis,
      })
    }
  } else {
    // Hot water dominates summer gas and runs year-round, so those two tips
    // annualize honestly; heating-season load is deliberately excluded. If the
    // user listed what burns gas and a water heater was not on it, they do not
    // apply at all.
    const gasUses = ans(answers, 'gas', 'gas-uses')
    const hasGasWater = !gasUses.length || gasUses.includes('Water heater')
    const annualHotWater = a.days ? a.totalCost * (365 / a.days) * 0.85 : 0
    if (hasGasWater && annualHotWater > 0) {
      ests.push({
        label: 'Shorter showers, same comfort',
        perYr: 0.15 * annualHotWater,
        note: '15% of annualised hot-water gas. Heating-season load is excluded from the base.',
      })
      ests.push({
        label: 'Wash clothes cold',
        perYr: 0.08 * annualHotWater,
        note: '8% of annualised hot-water gas, the share a typical laundry load draws.',
      })
    }
    const idleThr = a.activeGas?.idleThr ?? 0.15
    const idle = a.daily.filter((d) => d.usage < idleThr)
    if (idle.length >= 5 && a.totalUsage > 0) {
      const idleDraw = idle.reduce((x, d) => x + d.usage, 0) / idle.length
      const rate = a.totalCost / a.totalUsage
      ests.push({
        label: 'Fix the pilot-light draw',
        perYr: idleDraw * 365 * rate,
        note: `Your ${idle.length} idle days average ${idleDraw.toFixed(2)} therms with nothing running.`,
      })
    }
  }
  return ests.filter((e) => e.perYr >= 5).sort((x, y) => y.perYr - x.perYr).slice(0, 3)
}

/** Total annual estimate, unrounded. Lets the UI show what the answers moved. */
export function savingsTotalPerYr(
  a: FuelAnalysis,
  profile: Profile | null,
  answers?: AnswerMap,
  evMeta?: Record<string, EvMetaEntry>,
): number {
  return estimateSavings(a, profile, answers, evMeta).reduce((x, e) => x + e.perYr, 0)
}

/** Dollar estimate behind the playbook's "~$X this summer" chip. */
export function precoolEstimate(
  a: FuelAnalysis,
  profile: Profile | null,
  answers?: AnswerMap,
  evMeta?: Record<string, EvMetaEntry>,
): number | null {
  return estimateSavings(a, profile, answers, evMeta).find((e) => e.label.startsWith('Pre-cool'))?.perYr ?? null
}

export function buildSavings(
  a: FuelAnalysis,
  profile: Profile | null,
  answers?: AnswerMap,
  evMeta?: Record<string, EvMetaEntry>,
): { items: SavingItem[]; total: string } {
  const ests = estimateSavings(a, profile, answers, evMeta)
  const max = ests[0]?.perYr || 1
  return {
    items: ests.map((e) => ({
      label: e.label,
      amt: `${fmtMoney0(e.perYr)}/yr`,
      w: Math.max(8, Math.round((e.perYr / max) * 100)) + '%',
      note: e.note,
    })),
    total: fmtMoney0(ests.reduce((x, e) => x + e.perYr, 0)),
  }
}

export function buildInsights(
  a: FuelAnalysis,
  profile: Profile | null,
  answers?: AnswerMap,
  evMeta?: Record<string, EvMetaEntry>,
): Insight[] {
  const out: Insight[] = []
  if (a.fuel === 'electric') {
    if (a.tou) {
      const shift = estimateSavings(a, profile, answers, evMeta).find((e) => e.label.startsWith('Shift'))
      // Once they have told us what runs at peak, name the movable ones back
      // instead of guessing.
      const named = ans(answers, 'electric', 'peak').filter(
        (o) => (PEAK_MOVABLE[o] ?? UNKNOWN_MOVABLE) >= 0.5,
      )
      const mover = named.length
        ? named.slice(0, 2).join(' and ').toLowerCase()
        : profile?.has_ev
          ? 'EV charging'
          : 'dishwasher runs'
      out.push({
        icon: 'ph-fill ph-warning-circle',
        color: 'rgb(255,133,115)',
        title: `${Math.round(a.tou.peakCostShare * 100)}% of your cost lands in the ${a.tou.label} peak`,
        chip: shift ? `~${fmtMoney0(shift.perYr)}/yr` : '',
        body: `Peak power costs $${a.tou.peakRate.toFixed(2)} vs $${a.tou.offRate.toFixed(2)} off-peak. Laundry, ${mover} and oven time can all move.`,
      })
    }
    if (a.alwaysOn) {
      const modest = a.alwaysOn.kwhPerHr < 0.5
      out.push({
        icon: modest ? 'ph-fill ph-check-circle' : 'ph-fill ph-warning-circle',
        color: modest ? 'rgb(4,196,10)' : 'rgb(255,133,115)',
        title: modest ? 'Your always-on load is modest' : 'Your always-on load runs high',
        chip: '',
        body: `${a.alwaysOn.kwhPerHr.toFixed(2)} kWh every hour, about ${fmtMoney0(a.alwaysOn.monthlyCost)}/mo of standby. ${modest ? 'Below' : 'Above'} typical for ${homeNoun(profile)}.`,
      })
    }
    if (out.length < 3 && Math.abs(a.weekendDeltaPct) >= 8) {
      const home = profile?.occupancy === 'Away 9–5'
      out.push({
        icon: 'ph-fill ph-info',
        color: 'rgb(41,149,255)',
        title:
          a.weekendDeltaPct > 0
            ? `Weekends run ${a.weekendDeltaPct}% higher`
            : `Weekdays run ${-a.weekendDeltaPct}% higher`,
        chip: '',
        body:
          a.weekendDeltaPct > 0
            ? home
              ? 'Consistent with being away 9–5 on weekdays. Weekend daytime use is where flexible loads can shift.'
              : 'Someone’s home. Weekend daytime hours are where flexible loads can shift.'
            : 'Unusual for a home. Worth checking what runs on weekdays while you’re out.',
      })
    }
    if (out.length < 3 && a.quietest) {
      out.push({
        icon: 'ph-fill ph-info',
        color: 'rgb(41,149,255)',
        title: `${fmtMonthDay(a.quietest.date)} ran ${a.quietest.belowPct}% below normal`,
        chip: '',
        body: 'Quiet days like this reveal your true baseline. Confirm whether you were away in Activity.',
      })
    }
  } else {
    if (a.activeGas) {
      out.push({
        icon: 'ph-fill ph-info',
        color: 'rgb(41,149,255)',
        title: 'Summer gas is mostly hot water',
        chip: '',
        body: `Heating is off. The steady ~${a.activeGas.avgWhenOn.toFixed(2)} therm days are your water heater and stove.`,
      })
      out.push({
        icon: 'ph-fill ph-check-circle',
        color: 'rgb(4,196,10)',
        title: `${a.activeGas.idleDays} of ${a.activeGas.of} days used almost no gas`,
        chip: '',
        body: 'Your baseline is healthy. Nothing looks stuck on.',
      })
    }
    if (a.gasSpike) {
      out.push({
        icon: 'ph-fill ph-warning-circle',
        color: 'rgb(255,133,115)',
        title: `One unusual day: ${fmtMonthDay(a.gasSpike.date)}`,
        chip: '',
        body: `${a.gasSpike.therms.toFixed(1)} therms, about ${a.gasSpike.ratio >= 1.75 ? 'double' : a.gasSpike.ratio.toFixed(1) + '×'} a normal active day. Guests, extra laundry, or a long shower marathon?`,
      })
    }
  }
  return out.slice(0, 3)
}

export function buildQuestions(
  a: FuelAnalysis,
  profile: Profile | null,
  answers?: AnswerMap,
  evMeta?: Record<string, EvMetaEntry>,
): QDef[] {
  const qs: QDef[] = []
  if (a.fuel === 'electric') {
    if (a.alwaysOn) {
      const trim = estimateSavings(a, profile, answers, evMeta).find((e) => e.label.startsWith('Trim'))
      qs.push({
        id: 'always-on',
        tag: 'Baseline',
        money: trim ? `the ${fmtMoney0(trim.perYr)}/yr question` : '',
        text: 'Which of these run around the clock at your place?',
        multi: true,
        opts: [
          'Fridge',
          'Wi-Fi & modem',
          'Desktop PC',
          'Fish tank',
          'Security cameras',
          ...(profile?.has_pool ? ['Pool pump'] : []),
        ],
      })
    }
    if (a.sharpest) {
      const rate = a.totalUsage ? a.totalCost / a.totalUsage : 0
      const ifWeekly = a.sharpest.kwh * rate * 52
      qs.push({
        id: 'spike-cause',
        tag: 'Spike',
        money: ifWeekly >= 5 ? `the ${fmtMoney0(ifWeekly)}/yr question` : '',
        text: `Your sharpest spike was ${fmtDayShort(a.sharpest.date)} around ${hourLabel(a.sharpest.hour)}: ${a.sharpest.kwh.toFixed(1)} kWh, about ${a.sharpest.ratio.toFixed(1)}× normal. What ran then?`,
        opts: ['AC', 'Laundry', 'Oven', profile?.has_ev ? 'EV charging' : 'Dishwasher', 'Not sure'],
      })
    }
    if (a.tou) {
      const shift = estimateSavings(a, profile, answers, evMeta).find((e) => e.label.startsWith('Shift'))
      qs.push({
        id: 'peak',
        tag: 'Peak window',
        money: shift ? `the ${fmtMoney0(shift.perYr)}/yr question` : '',
        text: `About ${a.tou.peakKwhPerDay.toFixed(1)} kWh/day lands in your ${a.tou.label} peak window. What is usually running then?`,
        multi: true,
        opts: ['Cooking', 'AC', 'TV & gaming', 'Laundry', ...(profile?.has_ev ? ['EV'] : [])],
      })
    }
    if (a.quietest) {
      qs.push({
        id: 'dip',
        tag: 'Quiet day',
        money: '',
        text: `Usage on ${fmtMonthDay(a.quietest.date)} was ${a.quietest.belowPct}% below normal. Were you home?`,
        opts: ['Yes, home', 'Away all day', 'Part of the day'],
      })
    }
  } else {
    const gasTotal = estimateSavings(a, profile, answers, evMeta)
    qs.push({
      id: 'gas-uses',
      tag: 'Profile',
      money: gasTotal.length
        ? `the ${fmtMoney0(gasTotal.reduce((x, e) => x + e.perYr, 0))}/yr question`
        : '',
      text: 'What uses gas in your home?',
      multi: true,
      opts: [
        'Water heater',
        'Stove',
        'Furnace',
        ...(profile?.has_electric_dryer ? [] : ['Dryer']),
        'Fireplace',
      ],
    })
    if (a.gasSpike) {
      qs.push({
        id: 'gas-day',
        tag: 'Spike',
        money: '',
        text: `${fmtMonthDay(a.gasSpike.date)} used about ${a.gasSpike.ratio >= 1.75 ? 'double' : a.gasSpike.ratio.toFixed(1) + '×'} the usual gas. Anything different that day?`,
        opts: ['Guests over', 'Extra laundry', 'Long showers', 'Not sure'],
      })
    }
  }
  return qs
}
