import type { FuelAnalysis } from './lib/analyze'
import type { Insight, QDef, SavingItem } from './lib/content'
import type { AcPlan } from './lib/acplan'
import type { RatesAnalysis } from './lib/rates'

export type Page = 'overview' | 'energy' | 'rates' | 'playbook' | 'activity'
export type Fuel = 'electric' | 'gas'
export type Metric = 'usage' | 'cost'
export type Theme = 'dark' | 'light'
export type Mode = 'demo' | 'live'
export type EventFilter = 'All' | 'Spikes' | 'Quiet days' | 'High'
export type ObTab = 'create' | 'signin'
export type TempUnit = 'F' | 'C'

/** Home facts — each one changes what the engine asks or suggests. */
export interface Profile {
  display_name: string | null
  zip: string | null
  home_type: string | null
  ac_type: string | null
  occupancy: string | null
  has_ev: boolean
  has_pool: boolean
  has_electric_dryer: boolean
}

export interface EvMetaEntry {
  cause?: string
  away?: boolean
}

/** Everything computed for one fuel's dashboard. */
export interface FuelBundle {
  analysis: FuelAnalysis
  /** Rate-plan analysis (hourly electric with costs only). */
  rates: RatesAnalysis | null
  insights: Insight[]
  savings: { items: SavingItem[]; total: string }
  questions: QDef[]
  fileName: string
  rangeNote: string
  totalNote: string
  uploadId: string | null
}

/** Everything the pages need: state, derived values and action handlers. */
export interface Hearth {
  page: Page
  fuel: Fuel
  metric: Metric
  theme: Theme
  filter: EventFilter
  ob: boolean
  obStep: number

  isDesktop: boolean
  isMobile: boolean
  elec: boolean
  light: boolean
  tempUnit: TempUnit
  setTempUnit: (u: TempUnit) => void
  acc: string
  accSoft: string

  mode: Mode
  isAuthed: boolean
  hasMyData: boolean
  greeting: string
  subtitle: string
  userLabel: { name: string; sub: string; initials: string }

  bundles: Partial<Record<Fuel, FuelBundle>>
  bundle: FuelBundle | null
  plan: AcPlan
  forecastIsSample: boolean
  zipMissing: boolean

  answers: Record<string, string[]>
  otherDraft: Record<string, string>
  evMeta: Record<string, EvMetaEntry>

  go: (page: Page) => void
  setFuel: (fuel: Fuel) => void
  setMetric: (metric: Metric) => void
  setFilter: (filter: EventFilter) => void
  toggleTheme: () => void
  setMode: (mode: Mode) => void

  openOb: (step?: number, tab?: ObTab) => void
  closeOb: () => void
  obNext: () => void
  obBack: () => void

  toggleAnswer: (key: string, opt: string, multi: boolean) => void
  removeCustomAnswer: (key: string, opt: string) => void
  clearAnswer: (key: string) => void
  setOtherDraft: (key: string, value: string) => void
  addOther: (key: string, multi: boolean) => void

  setCause: (fuel: Fuel, date: string, cause: string) => void
  toggleAway: (fuel: Fuel, date: string) => void
}
