// Insight, savings and diagnostic-question generation. Everything is derived
// from the analysis of the user's own data plus the few home facts collected
// in onboarding — each collected fact changes what gets asked or suggested,
// so nothing irrelevant is ever requested.

import type { FuelAnalysis } from './analyze'
import { quantile } from './stats'
import { fmtDayShort, fmtMoney0, fmtMonthDay, hourLabel } from './format'
import type { Profile } from '../types'

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

function estimateSavings(a: FuelAnalysis, profile: Profile | null): SavingEst[] {
  const ests: SavingEst[] = []
  const hasAC = profile?.ac_type !== 'No AC'
  if (a.fuel === 'electric') {
    const rate = a.totalUsage ? a.totalCost / a.totalUsage : 0
    if (a.tou) {
      const premium = a.tou.peakRate - a.tou.offRate
      // ~40% of peak-window load is plausibly movable (laundry, dishwasher, EV).
      ests.push({
        label: `Shift flexible loads off ${a.tou.label}`,
        perYr: 0.4 * a.tou.peakKwhPerDay * premium * 365,
      })
      if (hasAC && a.granularity === 'hourly') {
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
        ests.push({ label: 'Pre-cool before the peak', perYr: 0.3 * coolingDelta * premium * 120 })
      }
    }
    if (a.alwaysOn) {
      // ~15% of standby is realistically avoidable (idle electronics, old
      // equipment left on) — never a flat share of the whole baseline.
      const offRate = a.tou?.offRate ?? rate
      ests.push({
        label: 'Trim always-on phantom load',
        perYr: 0.15 * a.alwaysOn.kwhPerHr * 24 * 365 * offRate,
      })
    }
  } else {
    // Hot water dominates summer gas and runs year-round, so those two tips
    // annualize honestly; heating-season load is deliberately excluded.
    const annualHotWater = a.days ? a.totalCost * (365 / a.days) * 0.85 : 0
    if (annualHotWater > 0) {
      ests.push({ label: 'Shorter showers, same comfort', perYr: 0.15 * annualHotWater })
      ests.push({ label: 'Wash clothes cold', perYr: 0.08 * annualHotWater })
    }
    const idleThr = a.activeGas?.idleThr ?? 0.15
    const idle = a.daily.filter((d) => d.usage < idleThr)
    if (idle.length >= 5 && a.totalUsage > 0) {
      const idleDraw = idle.reduce((x, d) => x + d.usage, 0) / idle.length
      const rate = a.totalCost / a.totalUsage
      ests.push({ label: 'Fix the pilot-light draw', perYr: idleDraw * 365 * rate })
    }
  }
  return ests.filter((e) => e.perYr >= 5).sort((x, y) => y.perYr - x.perYr).slice(0, 3)
}

/** Dollar estimate behind the playbook's "~$X this summer" chip. */
export function precoolEstimate(a: FuelAnalysis, profile: Profile | null): number | null {
  return estimateSavings(a, profile).find((e) => e.label.startsWith('Pre-cool'))?.perYr ?? null
}

export function buildSavings(
  a: FuelAnalysis,
  profile: Profile | null,
): { items: SavingItem[]; total: string } {
  const ests = estimateSavings(a, profile)
  const max = ests[0]?.perYr || 1
  return {
    items: ests.map((e) => ({
      label: e.label,
      amt: `${fmtMoney0(e.perYr)}/yr`,
      w: Math.max(8, Math.round((e.perYr / max) * 100)) + '%',
    })),
    total: fmtMoney0(ests.reduce((x, e) => x + e.perYr, 0)),
  }
}

export function buildInsights(a: FuelAnalysis, profile: Profile | null): Insight[] {
  const out: Insight[] = []
  if (a.fuel === 'electric') {
    if (a.tou) {
      const shift = estimateSavings(a, profile).find((e) => e.label.startsWith('Shift'))
      const mover = profile?.has_ev ? 'EV charging' : 'dishwasher runs'
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
        body: `${a.alwaysOn.kwhPerHr.toFixed(2)} kWh every hour — about ${fmtMoney0(a.alwaysOn.monthlyCost)}/mo of standby. ${modest ? 'Below' : 'Above'} typical for ${homeNoun(profile)}.`,
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
              ? 'Consistent with being away 9–5 on weekdays — weekend daytime use is where flexible loads can shift.'
              : 'Someone’s home — weekend daytime hours are where flexible loads can shift.'
            : 'Unusual for a home — worth checking what runs on weekdays while you’re out.',
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
        body: `Heating is off — the steady ~${a.activeGas.avgWhenOn.toFixed(2)} therm days are your water heater and stove.`,
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
        body: `${a.gasSpike.therms.toFixed(1)} therms — about ${a.gasSpike.ratio >= 1.75 ? 'double' : a.gasSpike.ratio.toFixed(1) + '×'} a normal active day. Guests, extra laundry, or a long shower marathon?`,
      })
    }
  }
  return out.slice(0, 3)
}

export function buildQuestions(a: FuelAnalysis, profile: Profile | null): QDef[] {
  const qs: QDef[] = []
  if (a.fuel === 'electric') {
    if (a.alwaysOn) {
      const trim = estimateSavings(a, profile).find((e) => e.label.startsWith('Trim'))
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
        text: `Your sharpest spike was ${fmtDayShort(a.sharpest.date)} around ${hourLabel(a.sharpest.hour)} — ${a.sharpest.kwh.toFixed(1)} kWh, about ${a.sharpest.ratio.toFixed(1)}× normal. What ran then?`,
        opts: ['AC', 'Laundry', 'Oven', profile?.has_ev ? 'EV charging' : 'Dishwasher', 'Not sure'],
      })
    }
    if (a.tou) {
      const shift = estimateSavings(a, profile).find((e) => e.label.startsWith('Shift'))
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
    const gasTotal = estimateSavings(a, profile)
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
