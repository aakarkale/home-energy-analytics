import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { EventFilter, Fuel, FuelBundle, Hearth, Metric, ObTab, Page, TempUnit, Theme } from './types'
import { useMediaQuery } from './hooks'
import { useHearthStore } from './store'
import { analyzeFuel } from './lib/analyze'
import { buildRates } from './lib/rates'
import {
  buildInsights,
  buildQuestions,
  buildSavings,
  precoolEstimate,
  savingsTotalPerYr,
} from './lib/content'
import { buildAcPlan } from './lib/acplan'
import { SAMPLE_FORECAST } from './lib/sample'
import { fmtMoney, fmtMonthDay, fmtNum } from './lib/format'
import {
  locate,
  navigate,
  PAGE_PATHS,
  PAGE_TITLE,
  ROUTES,
  SITE_NAME,
  useDocumentTitle,
  usePath,
} from './lib/routes'
import { Landing } from './components/Landing'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { MobileTabBar } from './components/MobileTabBar'
import { Onboarding } from './components/Onboarding'
import { Overview } from './pages/Overview'
import { Energy } from './pages/Energy'
import { Rates } from './pages/Rates'
import { Playbook } from './pages/Playbook'
import { Activity } from './pages/Activity'
import { Settings } from './pages/Settings'
import { Account } from './pages/Account'

const THEME_KEY = 'hearth-theme'
// Per-tab, deliberately not localStorage: opening the demo should not replace
// the marketing page for this browser forever.
const DEMO_VISIT_KEY = 'hearth-demo-visit'
const TEMP_UNIT_KEY = 'hearth-temp-unit'

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
  const [tempUnit, setTempUnitState] = useState<TempUnit>(() => {
    try {
      return localStorage.getItem(TEMP_UNIT_KEY) === 'C' ? 'C' : 'F'
    } catch {
      return 'F'
    }
  })
  const path = usePath()
  const route = locate(path)
  // The URL is the source of truth for which screen is showing. An unknown
  // path inside the app falls back to Overview rather than a blank shell.
  const page: Page = route.page ?? 'overview'
  const [fuel, setFuel] = useState<Fuel>('electric')
  const [metric, setMetric] = useState<Metric>('usage')
  const [filter, setFilter] = useState<EventFilter>('All')
  const [demoVisit, setDemoVisit] = useState(() => {
    try {
      return sessionStorage.getItem(DEMO_VISIT_KEY) === '1'
    } catch {
      return false
    }
  })
  const [ob, setOb] = useState(false)
  const [obStep, setObStep] = useState(0)
  const [obTab, setObTab] = useState<ObTab>('create')
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
        insights: buildInsights(analysis, store.profile, store.answers, store.evMeta),
        savings: buildSavings(analysis, store.profile, store.answers, store.evMeta),
        answerLift:
          savingsTotalPerYr(analysis, store.profile, store.answers, store.evMeta) -
          savingsTotalPerYr(analysis, store.profile),
        questions: buildQuestions(analysis, store.profile, store.answers, store.evMeta),
        fileName: rec.parsed.fileName,
        rangeNote: `${fmtMonthDay(analysis.periodStart)} – ${fmtMonthDay(analysis.periodEnd)} · ${analysis.granularity} · ${rec.parsed.rowCount} rows`,
        totalNote: `${fmtNum(analysis.totalUsage, 1)} ${analysis.unit} · ${fmtMoney(analysis.totalCost)}`,
        uploadId: rec.id,
      }
    }
    return out
  }, [store.uploads, store.profile, store.answers, store.evMeta])

  // Who sees the app rather than the marketing page. Derived every render, never
  // remembered: a signed-in user, a guest holding their own upload, or someone
  // who opened the demo in this tab. Merely having visited before is not a
  // reason — that was the bug where the demo replaced the landing page for good.
  const inApp = !!store.session || store.hasMyData || demoVisit

  // Signing out clears the per-tab demo flag in the store; mirror that here so
  // the marketing page comes back instead of the sample dashboard.
  useEffect(() => {
    if (store.session) return
    try {
      if (sessionStorage.getItem(DEMO_VISIT_KEY) !== '1') setDemoVisit(false)
    } catch {
      /* private mode */
    }
  }, [store.session])

  // Landing on a password-reset link opens setup straight at the new-password
  // prompt, whatever else the browser remembered.
  useEffect(() => {
    if (!store.recovering) return
    setObStep(0)
    setOb(true)
  }, [store.recovering])

  // The URL asks for the auth dialog directly, so /signin and /signup are
  // linkable and countable like any other page.
  useEffect(() => {
    if (!route.authTab) return
    setObTab(route.authTab)
    setObStep(0)
    setOb(true)
  }, [route.authTab])

  // Reconcile the URL with what the visitor may actually see. Replaces rather
  // than pushes, so a corrected address never traps the back button.
  useEffect(() => {
    if (!store.authReady) return
    if (store.recovering) {
      if (!route.isReset) navigate(ROUTES.resetPassword, true)
      return
    }
    if (route.isReset) {
      navigate(inApp ? PAGE_PATHS.overview : ROUTES.landing, true)
      return
    }
    if (inApp) {
      if (!route.page && !route.authTab) navigate(PAGE_PATHS.overview, true)
    } else if (route.page) {
      // A deep link into the app without a session or data shows the front door.
      navigate(ROUTES.landing, true)
    }
  }, [store.authReady, store.recovering, inApp, route.page, route.authTab, route.isReset])

  useDocumentTitle(
    inApp && route.page
      ? `${PAGE_TITLE[route.page]} · ${SITE_NAME}`
      : `${SITE_NAME} | Home Energy Analytics`,
  )

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
        bundles.electric
          ? precoolEstimate(bundles.electric.analysis, store.profile, store.answers, store.evMeta)
          : null,
      ),
    [bundles.electric, store.profile, forecast, store.answers, store.evMeta],
  )

  const bundle = bundles[fuel] ?? null
  const isAuthed = !!store.session

  const email = store.session?.user?.email ?? ''
  // An account created without a name saves '' rather than null, so a plain
  // ?? would leave the greeting hanging after its comma.
  const savedName = store.profile.display_name?.trim() || ''
  const handle = email.split('@')[0] || ''
  const fullName = savedName || handle

  const firstName = store.mode === 'demo' ? 'Sam' : fullName.split(/\s+/)[0] || 'there'
  const greeting = `Good ${partOfDay()}, ${firstName}`

  const userLabel =
    store.mode === 'demo'
      ? { name: 'Demo home', sub: 'Sample data', initials: 'DH' }
      : isAuthed
        ? {
            name: fullName || email,
            sub: email,
            initials:
              (fullName || email)
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
    tempUnit,
    setTempUnit: (u: TempUnit) => {
      try {
        localStorage.setItem(TEMP_UNIT_KEY, u)
      } catch {
        /* private mode */
      }
      setTempUnitState(u)
    },
    acc,
    accSoft,

    mode: store.mode,
    isAuthed,
    hasMyData: store.hasMyData,
    onboarded: store.onboarded,
    greeting,
    // Settings and Account are not about a billing period, so the data range
    // would be noise there.
    subtitle:
      page === 'settings'
        ? 'PREFERENCES · UNITS · YOUR DATA'
        : page === 'account'
          ? (isAuthed ? email.toUpperCase() : 'GUEST · NOT SIGNED IN')
          : bundle
            ? bundle.analysis.rangeLabel
            : 'NO DATA YET',
    userLabel,

    bundles,
    bundle,
    plan,
    forecastIsSample: store.mode === 'demo',
    zipMissing: store.mode === 'live' && !store.profile.zip,

    answers: store.answers,
    otherDraft,
    evMeta: store.evMeta,

    go: (p) => navigate(PAGE_PATHS[p]),
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

    openOb: (step = 0, tab) => {
      setObStep(step)
      if (tab) setObTab(tab)
      setOb(true)
    },
    closeOb: () => {
      setOb(false)
      if (locate(window.location.pathname).authTab) navigate(ROUTES.landing, true)
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

  const enterApp = (kind: 'create' | 'signin' | 'demo') => {
    if (kind === 'demo') {
      try {
        sessionStorage.setItem(DEMO_VISIT_KEY, '1')
      } catch {
        /* private mode */
      }
      setDemoVisit(true)
      store.setMode('demo')
      setOb(false)
      navigate(PAGE_PATHS.overview)
      return
    }
    // Sign up / sign in open over the landing page. The app appears only once
    // there is a real session, so a user awaiting email confirmation is never
    // dropped into the demo dashboard.
    navigate(kind === 'create' ? ROUTES.signUp : ROUTES.signIn)
  }

  // Restoring a session is async; painting the landing page first would flash
  // the marketing site at users who are already signed in.
  if (!store.authReady) {
    return (
      <div
        className={light ? 'hearth-light' : undefined}
        style={{ height: '100%', width: '100%', background: 'var(--bg-0)' }}
      />
    )
  }

  if (!inApp) {
    return (
      <div
        className={light ? 'hearth-light' : undefined}
        style={
          {
            height: '100%',
            width: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            fontFamily: 'var(--font-dm-sans)',
            color: 'var(--fg-1)',
            background: 'var(--bg-0)',
            letterSpacing: '-0.01em',
            '--acc': 'rgb(255,221,85)',
            '--accSoft': 'rgba(255,221,85,0.13)',
          } as CSSProperties
        }
      >
        <Landing enter={enterApp} />
        {ob && <Onboarding hearth={hearth} store={store} initialTab={obTab} />}
      </div>
    )
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
          <Header hearth={hearth} store={store} />

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
              {page === 'settings' && <Settings hearth={hearth} store={store} />}
              {page === 'account' && <Account hearth={hearth} store={store} />}
            </div>
          </div>

          {isMobile && <MobileTabBar hearth={hearth} />}
        </div>
      </div>

      {ob && <Onboarding hearth={hearth} store={store} initialTab={obTab} />}
    </div>
  )
}
