import type { Fuel, Page } from './types'

export const NAV_PAGES: { id: Page; label: string; short: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', short: 'Home', icon: 'ph ph-squares-four' },
  { id: 'energy', label: 'Energy', short: 'Energy', icon: 'ph ph-chart-line-up' },
  { id: 'rates', label: 'Rates', short: 'Rates', icon: 'ph ph-receipt' },
  { id: 'playbook', label: 'AC Playbook', short: 'Playbook', icon: 'ph ph-snowflake' },
  { id: 'activity', label: 'Activity', short: 'Activity', icon: 'ph ph-pulse' },
]

export const PAGE_TITLES: Record<Page, string> = {
  overview: '', // greeting is dynamic
  energy: 'Energy',
  rates: 'Rates',
  playbook: 'AC Playbook',
  activity: 'Activity',
  settings: 'Settings',
  account: 'Account',
}

/** Which screens actually read the selected fuel. The switch is only shown on
 *  these, because on the others it would change nothing you can see:
 *
 *  - Rates and AC Playbook read `bundles.electric` directly. Gas has no TOU
 *    window and no thermostat, so both are electricity-only by construction.
 *  - Settings and Account are not per-fuel views at all.
 *
 *  An allow-list rather than a deny-list, so a screen added later has to opt in
 *  and cannot inherit an inert control by default. */
export const PER_FUEL_PAGES: Record<Page, boolean> = {
  overview: true,
  energy: true,
  activity: true,
  rates: false,
  playbook: false,
  settings: false,
  account: false,
}

export const FUEL_TABS: { id: Fuel; label: string; icon: string; activeFg: string }[] = [
  { id: 'electric', label: 'Electricity', icon: 'ph-fill ph-lightning', activeFg: 'rgb(255,221,85)' },
  { id: 'gas', label: 'Gas', icon: 'ph-fill ph-flame', activeFg: 'rgb(41,149,255)' },
]

export const FUEL_ICON: Record<Fuel, { icon: string; color: string }> = {
  electric: { icon: 'ph-fill ph-lightning', color: 'rgb(255,221,85)' },
  gas: { icon: 'ph-fill ph-flame', color: 'rgb(41,149,255)' },
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
