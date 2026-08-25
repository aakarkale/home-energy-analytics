import type { Fuel, Page } from './types'

export const NAV_PAGES: { id: Page; label: string; short: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', short: 'Home', icon: 'ph ph-squares-four' },
  { id: 'energy', label: 'Energy', short: 'Energy', icon: 'ph ph-chart-line-up' },
  { id: 'playbook', label: 'AC Playbook', short: 'Playbook', icon: 'ph ph-snowflake' },
  { id: 'activity', label: 'Activity', short: 'Activity', icon: 'ph ph-pulse' },
]

export const PAGE_TITLES: Record<Page, string> = {
  overview: 'Good morning, Aakar',
  energy: 'Energy',
  playbook: 'AC Playbook',
  activity: 'Activity',
}

export const FUEL_TABS: { id: Fuel; label: string; icon: string; activeFg: string }[] = [
  { id: 'electric', label: 'Electricity', icon: 'ph-fill ph-lightning', activeFg: 'rgb(255,221,85)' },
  { id: 'gas', label: 'Gas', icon: 'ph-fill ph-flame', activeFg: 'rgb(41,149,255)' },
]

export interface QDef {
  id: string
  tag: string
  money: string
  text: string
  multi?: boolean
  opts: string[]
}

export function getQDefs(elec: boolean): QDef[] {
  return elec
    ? [
        {
          id: 'always-on',
          tag: 'Baseline',
          money: 'the $80/yr question',
          text: 'Which of these run around the clock at your place?',
          multi: true,
          opts: ['Fridge', 'Wi-Fi & modem', 'Desktop PC', 'Fish tank', 'Security cameras'],
        },
        {
          id: 'spike-cause',
          tag: 'Spike',
          money: 'the $45/yr question',
          text: 'Your sharpest spike was Thu Aug 3 around 12 PM — 2.4 kWh, about 3.5× normal. What ran then?',
          opts: ['AC', 'Laundry', 'Oven', 'EV charging', 'Not sure'],
        },
        {
          id: 'peak',
          tag: 'Peak window',
          money: 'the $168/yr question',
          text: 'About 9.9 kWh/day lands in your 4–9 PM peak window. What is usually running then?',
          multi: true,
          opts: ['Cooking', 'AC', 'TV & gaming', 'Laundry', 'EV'],
        },
        {
          id: 'dip',
          tag: 'Quiet day',
          money: 'the $95/yr question',
          text: 'Usage on Aug 7 was 78% below normal. Were you home?',
          opts: ['Yes, home', 'Away all day', 'Part of the day'],
        },
      ]
    : [
        {
          id: 'gas-uses',
          tag: 'Profile',
          money: 'the $55/yr question',
          text: 'What uses gas in your home?',
          multi: true,
          opts: ['Water heater', 'Stove', 'Furnace', 'Dryer', 'Fireplace'],
        },
        {
          id: 'gas-day',
          tag: 'Spike',
          money: 'the $20/yr question',
          text: 'Aug 20 used about double the usual gas. Anything different that day?',
          opts: ['Guests over', 'Extra laundry', 'Long showers', 'Not sure'],
        },
      ]
}

export function questionProgress(answers: Record<string, string[]>, fuel: Fuel) {
  const elec = fuel === 'electric'
  const qTotal = elec ? 7 : 4
  const answered = Object.keys(answers).filter((k) => k.startsWith(fuel)).length
  return {
    answered,
    qProg: answered + ' of ' + qTotal,
    qProgW: Math.round((answered / qTotal) * 100) + '%',
  }
}

export interface EvDef {
  id: string
  sev: 'high' | 'med' | 'low'
  type: 'Spike' | 'Quiet day' | 'Estimated'
  title: string
  cost: string
  detail: string
  tip: string
}

export function getEvDefs(elec: boolean): EvDef[] {
  return elec
    ? [
        {
          id: 'e1',
          sev: 'high',
          type: 'Spike',
          title: 'Evening spike · Thu Aug 3',
          cost: '+$4.10',
          detail:
            '5–8 PM ran 2.6× your usual evening — 14.2 kWh in three hours, right inside the peak window.',
          tip: 'If this was laundry or oven + AC together, staggering them past 9 PM would have cost 25% less.',
        },
        {
          id: 'e2',
          sev: 'med',
          type: 'Spike',
          title: 'High day · Sat Aug 15',
          cost: '+$6.80',
          detail: '88 kWh — 56% above a typical Saturday. Spread across the whole day rather than one hour.',
          tip: 'Whole-day highs usually mean AC on a hot day. Check the playbook pre-cool for days like this.',
        },
        {
          id: 'e3',
          sev: 'low',
          type: 'Quiet day',
          title: 'Quiet day · Fri Aug 7',
          cost: '−$17.20',
          detail: '19 kWh, 66% below normal — this is close to your true always-on baseline.',
          tip: 'Days like this are gold: mark "I was away" and we measure your phantom load precisely.',
        },
        {
          id: 'e4',
          sev: 'low',
          type: 'Estimated',
          title: 'Estimated reading · Aug 17',
          cost: '—',
          detail: 'PG&E flagged this day as estimated, not measured. Treat its numbers loosely.',
          tip: 'Estimated days are excluded from spike detection so they never trigger false alarms.',
        },
      ]
    : [
        {
          id: 'g1',
          sev: 'med',
          type: 'Spike',
          title: 'High gas day · Thu Aug 20',
          cost: '+$1.70',
          detail: '2.1 therms — about double a normal active day.',
          tip: 'One-off gas highs are usually hot water: guests, laundry, long showers.',
        },
        {
          id: 'g2',
          sev: 'low',
          type: 'Quiet day',
          title: '11 near-zero days in a row',
          cost: '—',
          detail: 'Aug 8–18 used almost no gas — heating off, minimal hot water.',
          tip: 'A healthy summer pattern. If winter shows this, check the pilot light.',
        },
      ]
}

export const SEV_COLOR = {
  high: 'rgb(255,69,56)',
  med: 'rgb(255,133,115)',
  low: 'rgb(174,134,232)',
} as const

export const SEV_BG = {
  high: 'rgba(255,69,56,0.1)',
  med: 'rgba(255,133,115,0.1)',
  low: 'rgba(174,134,232,0.12)',
} as const

export const CAUSE_OPTS = [
  'What caused this?',
  'AC / cooling',
  'Laundry',
  'Cooking',
  'EV charging',
  'Guests',
  'Something else',
]

/** v ≥ 100 → rounded with thousands separator, else one decimal. */
export const fmt1 = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1))
