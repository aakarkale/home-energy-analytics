export type Page = 'overview' | 'energy' | 'playbook' | 'activity'
export type Fuel = 'electric' | 'gas'
export type Metric = 'usage' | 'cost'
export type Theme = 'dark' | 'light'
export type EventFilter = 'All' | 'Spikes' | 'Quiet days' | 'High'
export type ObTab = 'create' | 'signin'

export interface ObSel {
  ac: string
  occ: string
  home: string
  extras: Record<string, boolean>
}

export interface EvMetaEntry {
  cause?: string
  away?: boolean
}

/** Everything the pages need: state, derived values and action handlers. */
export interface Hearth {
  page: Page
  fuel: Fuel
  metric: Metric
  theme: Theme
  filter: EventFilter
  answers: Record<string, string[]>
  otherDraft: Record<string, string>
  evMeta: Record<string, EvMetaEntry>
  obSel: ObSel
  ob: boolean
  obStep: number
  obTab: ObTab

  isDesktop: boolean
  isMobile: boolean
  elec: boolean
  light: boolean
  acc: string
  accSoft: string

  go: (page: Page) => void
  setFuel: (fuel: Fuel) => void
  setMetric: (metric: Metric) => void
  setFilter: (filter: EventFilter) => void
  toggleTheme: () => void

  toggleAnswer: (key: string, opt: string, multi: boolean) => void
  removeCustomAnswer: (key: string, opt: string) => void
  clearAnswer: (key: string) => void
  setOtherDraft: (key: string, value: string) => void
  addOther: (key: string, multi: boolean) => void

  setCause: (id: string, cause: string) => void
  toggleAway: (id: string) => void

  openOb: () => void
  closeOb: () => void
  obNext: () => void
  obBack: () => void
  setObTab: (tab: ObTab) => void
  pickObOption: (groupKey: keyof ObSel, opt: string, multi: boolean) => void
}
