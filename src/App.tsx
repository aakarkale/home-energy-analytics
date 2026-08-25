import { useState, type CSSProperties } from 'react'
import type { EvMetaEntry, EventFilter, Fuel, Hearth, Metric, ObSel, ObTab, Page, Theme } from './types'
import { useMediaQuery } from './hooks'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { MobileTabBar } from './components/MobileTabBar'
import { Onboarding } from './components/Onboarding'
import { Overview } from './pages/Overview'
import { Energy } from './pages/Energy'
import { Playbook } from './pages/Playbook'
import { Activity } from './pages/Activity'

const THEME_KEY = 'hearth-theme'
const SETUP_KEY = 'hearth-setup-done'

export default function App() {
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
  // The prototype exposes startWithOnboarding as a canvas prop; in the real
  // app the equivalent is "open setup on first visit".
  const [ob, setOb] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SETUP_KEY) !== '1'
    } catch {
      return false
    }
  })
  const [obStep, setObStep] = useState(0)
  const [obTab, setObTab] = useState<ObTab>('create')
  const [filter, setFilter] = useState<EventFilter>('All')
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [otherDraft, setOtherDraftState] = useState<Record<string, string>>({})
  const [evMeta, setEvMeta] = useState<Record<string, EvMetaEntry>>({})
  const [obSel, setObSel] = useState<ObSel>({
    ac: 'Central AC',
    occ: 'Away 9–5',
    home: 'House',
    extras: {},
  })

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

  const hearth: Hearth = {
    page,
    fuel,
    metric,
    theme,
    filter,
    answers,
    otherDraft,
    evMeta,
    obSel,
    ob,
    obStep,
    obTab,

    isDesktop,
    isMobile,
    elec,
    light,
    acc,
    accSoft,

    go: (p) => setPage(p),
    setFuel,
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

    toggleAnswer: (key, opt, multi) => {
      setAnswers((prev) => {
        const a = { ...prev }
        let cur = a[key] || []
        const on = cur.includes(opt)
        if (multi) {
          cur = on ? cur.filter((x) => x !== opt) : [...cur, opt]
        } else {
          cur = on ? [] : [opt]
        }
        if (cur.length) a[key] = cur
        else delete a[key]
        return a
      })
    },
    removeCustomAnswer: (key, opt) => {
      setAnswers((prev) => {
        const a = { ...prev }
        const cur = (a[key] || []).filter((x) => x !== opt)
        if (cur.length) a[key] = cur
        else delete a[key]
        return a
      })
    },
    clearAnswer: (key) => {
      setAnswers((prev) => {
        const a = { ...prev }
        delete a[key]
        return a
      })
    },
    setOtherDraft: (key, value) => {
      setOtherDraftState((prev) => ({ ...prev, [key]: value.slice(0, 15) }))
    },
    addOther: (key, multi) => {
      const v = (otherDraft[key] || '').trim().slice(0, 15)
      if (!v) return
      setAnswers((prev) => {
        const a = { ...prev }
        let cur = a[key] || []
        if (!cur.includes(v)) {
          cur = multi ? [...cur, v] : [v]
        }
        a[key] = cur
        return a
      })
      setOtherDraftState((prev) => ({ ...prev, [key]: '' }))
    },

    setCause: (id, cause) => {
      setEvMeta((prev) => ({ ...prev, [id]: { ...prev[id], cause } }))
    },
    toggleAway: (id) => {
      setEvMeta((prev) => ({ ...prev, [id]: { ...prev[id], away: !prev[id]?.away } }))
    },

    openOb: () => {
      setOb(true)
      setObStep(0)
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
    setObTab,
    pickObOption: (groupKey, opt, multi) => {
      setObSel((prev) => {
        const sel = { ...prev }
        if (multi) {
          sel.extras = { ...sel.extras, [opt]: !sel.extras[opt] }
        } else if (groupKey !== 'extras') {
          sel[groupKey] = opt
        }
        return sel
      })
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
        {isDesktop && <Sidebar hearth={hearth} />}

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
              {page === 'overview' && <Overview hearth={hearth} />}
              {page === 'energy' && <Energy hearth={hearth} />}
              {page === 'playbook' && <Playbook hearth={hearth} />}
              {page === 'activity' && <Activity hearth={hearth} />}
            </div>
          </div>

          {isMobile && <MobileTabBar hearth={hearth} />}
        </div>
      </div>

      {ob && <Onboarding hearth={hearth} />}
    </div>
  )
}
