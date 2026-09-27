import type { FuelAnalysis } from './lib/analyze'
import type { Insight, QDef, SavingItem } from './lib/content'
import type { AcPlan } from './lib/acplan'
import type { RatesAnalysis } from './lib/rates'

export type Page = 'overview' | 'energy' | 'rates' | 'playbook' | 'calibrate' | 'settings' | 'account'
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

/**
 * What has been filed away from Calibrate: answers keyed like `answers`
 * (`fuel:questionId`) and event tags keyed like `evMeta` (`fuel:date`). Filing
 * only tidies the page; archived answers and tags keep refining every estimate.
 */
export interface Archive {
  answers: string[]
  events: string[]
}

/** Everything computed for one fuel's dashboard. */
export interface FuelBundle {
  analysis: FuelAnalysis
  /** Rate-plan analysis (hourly electric with costs only). */
  rates: RatesAnalysis | null
  insights: Insight[]
  savings: { items: SavingItem[]; total: string }
  /** Dollars per year the diagnostic answers moved the estimate, versus the
   *  same data with nothing answered. Drives the "your answers did this" line. */
  answerLift: number
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
  /** True once this account has finished the setup wizard. Drives whether the
   *  "replay setup" affordance is still worth showing. */
  onboarded: boolean
  /** True when a visitor is here only to look at the demo: not signed in and
   *  holding no upload of their own. They get Exit demo in place of the
   *  profile menu. */
  demoVisitor: boolean
  greeting: string
  subtitle: string
  userLabel: { name: string; sub: string; initials: string }

  bundles: Partial<Record<Fuel, FuelBundle>>
  bundle: FuelBundle | null
  plan: AcPlan
  forecastIsSample: boolean
  /** When the live forecast was pulled. Null in demo mode or with no ZIP. */
  forecastAt: number | null
  forecastLoading: boolean
  forecastFailed: boolean
  refreshForecast: () => void
  zipMissing: boolean
  /** The ZIP the live forecast is for. Null in demo mode or with no ZIP set. */
  forecastZip: string | null

  answers: Record<string, string[]>
  otherDraft: Record<string, string>
  evMeta: Record<string, EvMetaEntry>
  archive: Archive

  go: (page: Page) => void
  setFuel: (fuel: Fuel) => void
  setMetric: (metric: Metric) => void
  setFilter: (filter: EventFilter) => void
  toggleTheme: () => void
  setMode: (mode: Mode) => void
  /** Leaves the demo for the landing page. */
  exitDemo: () => void

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
  /** Files answers and event tags away from Calibrate, or brings them back. */
  setArchived: (change: Partial<Archive>, archived: boolean) => void
}
