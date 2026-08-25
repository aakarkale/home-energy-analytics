import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { EventFilter, Fuel, FuelBundle, Hearth, Metric, Page, Theme } from './types'
import { useMediaQuery } from './hooks'
import { useHearthStore } from './store'
import { analyzeFuel } from './lib/analyze'
import { buildRates } from './lib/rates'
import { buildInsights, buildQuestions, buildSavings, precoolEstimate } from './lib/content'
import { buildAcPlan } from './lib/acplan'
import { SAMPLE_FORECAST } from './lib/sample'
import { fmtMoney, fmtMonthDay, fmtNum } from './lib/format'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { MobileTabBar } from './components/MobileTabBar'
import { Onboarding } from './components/Onboarding'
import { Overview } from './pages/Overview'
import { Energy } from './pages/Energy'
import { Rates } from './pages/Rates'
import { Playbook } from './pages/Playbook'
import { Activity } from './pages/Activity'

const THEME_KEY = 'hearth-theme'
const SETUP_KEY = 'hearth-setup-done'

function partOfDay(): string {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

export default function App() {
  const store = useHearthStore()
  const isDesktop = useMediaQuery('(min-width: 860px)')
  const isMobile = !isDesktop

  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem(THEME_KEY)
      return t === 'light' || t === 'dark' ? t : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [page, setPage] = useState<Page>('overview')
  const [fuel, setFuel] = useState<Fuel>('electric')
  const [metric, setMetric] = useState<Metric>('usage')
  const [filter, setFilter] = useState<EventFilter>('All')
  const [ob, setOb] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SETUP_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [obStep, setObStep] = useState(0)
  const [otherDraft, setOtherDraftState] = useState<Record<string, string>>({})

  const elec = fuel === 'electric'
  const light = theme === 'light'
  const acc = elec
    ? light
      ? 'rgb(176,120,0)'
      : 'rgb(255,221,85)'
    : light
      ? 'rgb(10,110,220)'
      : 'rgb(41,149,255)'
  const accSoft = elec
    ? light
      ? 'rgba(176,120,0,0.12)'
      : 'rgba(255,221,85,0.13)'
    : light
      ? 'rgba(10,110,220,0.10)'
      : 'rgba(41,149,255,0.14)'

  // Run the engine over whichever uploads the active mode provides.
  const bundles = useMemo(() => {
    const out: Partial<Record<Fuel, FuelBundle>> = {}
    for (const f of ['electric', 'gas'] as Fuel[]) {
      const rec = store.uploads[f]
      if (!rec) continue
      const analysis = analyzeFuel(rec.parsed, rec.billing)
      out[f] = {
        analysis,
        rates: f === 'electric' ? buildRates(rec.parsed, analysis.tou, rec.billing) : null,
        insights: buildInsights(analysis, store.profile),
        savings: buildSavings(analysis, store.profile),
        questions: buildQuestions(analysis, store.profile),
        fileName: rec.parsed.fileName,
        rangeNote: `${fmtMonthDay(analysis.periodStart)} – ${fmtMonthDay(analysis.periodEnd)} · ${analysis.granularity} · ${rec.parsed.rowCount} rows`,
        totalNote: `${fmtNum(analysis.totalUsage, 1)} ${analysis.unit} · ${fmtMoney(analysis.totalCost)}`,
        uploadId: rec.id,
      }
    }
    return out
  }, [store.uploads, store.profile])

  // Until the user explicitly picks a fuel, follow whichever one has data —
  // an explicit pick sticks so the empty state stays reachable.
  const userPickedFuel = useRef(false)
  useEffect(() => {
    if (userPickedFuel.current) return
    if (!bundles[fuel]) {
      const other: Fuel = fuel === 'electric' ? 'gas' : 'electric'
      if (bundles[other]) setFuel(other)
    }
  }, [bundles, fuel])

  const forecast = store.mode === 'demo' ? SAMPLE_FORECAST : store.forecast
  const plan = useMemo(
    () =>
      buildAcPlan(
        bundles.electric?.analysis ?? null,
        store.profile,
        forecast,
        bundles.electric ? precoolEstimate(bundles.electric.analysis, store.profile) : null,
      ),
    [bundles.electric, store.profile, forecast],
  )

  const bundle = bundles[fuel] ?? null
  const isAuthed = !!store.session

  const firstName =
    store.mode === 'demo'
      ? 'Sam'
      : (store.profile.display_name?.trim().split(/\s+/)[0] ??
        store.session?.user?.email?.split('@')[0] ??
        'there')
  const greeting = `Good ${partOfDay()}, ${firstName}`

  const email = store.session?.user?.email ?? ''
  const userLabel =
    store.mode === 'demo'
      ? { name: 'Demo home', sub: 'Sample data', initials: 'DH' }
      : isAuthed
        ? {
            name: store.profile.display_name || email,
            sub: email,
            initials:
              (store.profile.display_name || email)
                .split(/[\s@._-]+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0]!.toUpperCase())
                .join('') || 'ME',
          }
        : { name: 'Guest', sub: 'Data stays in this browser', initials: 'G' }

  const hearth: Hearth = {
    page,
    fuel,
    metric,
    theme,
    filter,
    ob,
    obStep,

    isDesktop,
    isMobile,
    elec,
    light,
    acc,
    accSoft,

    mode: store.mode,
    isAuthed,
    hasMyData: store.hasMyData,
    greeting,
    subtitle: bundle ? bundle.analysis.rangeLabel : 'NO DATA YET',
    userLabel,

    bundles,
    bundle,
    plan,
    forecastIsSample: store.mode === 'demo',
    zipMissing: store.mode === 'live' && !store.profile.zip,

    answers: store.answers,
    otherDraft,
    evMeta: store.evMeta,

    go: (p) => setPage(p),
    setFuel: (f) => {
      userPickedFuel.current = true
      setFuel(f)
    },
    setMetric,
    setFilter,
    toggleTheme: () => {
      const t: Theme = theme === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem(THEME_KEY, t)
      } catch {
        /* private mode */
      }
      setTheme(t)
    },
    setMode: store.setMode,

    openOb: (step = 0) => {
      setObStep(step)
      setOb(true)
    },
    closeOb: () => {
      try {
        localStorage.setItem(SETUP_KEY, '1')
      } catch {
        /* private mode */
      }
      setOb(false)
    },
    obNext: () => setObStep((s) => Math.min(3, s + 1)),
    obBack: () => setObStep((s) => Math.max(0, s - 1)),

    toggleAnswer: (key, opt, multi) => {
      const cur = store.answers[key] || []
      const on = cur.includes(opt)
      const next = multi ? (on ? cur.filter((x) => x !== opt) : [...cur, opt]) : on ? [] : [opt]
      store.setAnswerValue(key, next.length ? next : null)
    },
    removeCustomAnswer: (key, opt) => {
      const next = (store.answers[key] || []).filter((x) => x !== opt)
      store.setAnswerValue(key, next.length ? next : null)
    },
    clearAnswer: (key) => store.setAnswerValue(key, null),
    setOtherDraft: (key, value) =>
      setOtherDraftState((prev) => ({ ...prev, [key]: value.slice(0, 15) })),
    addOther: (key, multi) => {
      const v = (otherDraft[key] || '').trim().slice(0, 15)
      if (!v) return
      const cur = store.answers[key] || []
      if (!cur.includes(v)) store.setAnswerValue(key, multi ? [...cur, v] : [v])
      setOtherDraftState((prev) => ({ ...prev, [key]: '' }))
    },

    setCause: (f, date, cause) => {
      const meta = store.evMeta[`${f}:${date}`] || {}
      store.setEvMeta(f, date, { ...meta, cause })
    },
    toggleAway: (f, date) => {
      const meta = store.evMeta[`${f}:${date}`] || {}
      store.setEvMeta(f, date, { ...meta, away: !meta.away })
    },
  }

  return (
    <div
      className={light ? 'hearth-light' : undefined}
      style={
        {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--font-dm-sans)',
          color: 'var(--fg-1)',
          background: 'var(--bg-1)',
          overflow: 'hidden',
          position: 'relative',
          letterSpacing: '-0.01em',
          '--acc': acc,
          '--accSoft': accSoft,
        } as CSSProperties
      }
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {isDesktop && <Sidebar hearth={hearth} store={store} />}

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-0)',
          }}
        >
          <Header hearth={hearth} />

          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px 28px' }}>
            <div
              style={{
                maxWidth: 1080,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                paddingBottom: isMobile ? 90 : 24,
              }}
            >
              {page === 'overview' && <Overview hearth={hearth} store={store} />}
              {page === 'energy' && <Energy hearth={hearth} />}
              {page === 'rates' && <Rates hearth={hearth} />}
              {page === 'playbook' && <Playbook hearth={hearth} />}
              {page === 'activity' && <Activity hearth={hearth} />}
            </div>
          </div>

          {isMobile && <MobileTabBar hearth={hearth} />}
        </div>
      </div>

      {ob && <Onboarding hearth={hearth} store={store} />}
    </div>
  )
}
