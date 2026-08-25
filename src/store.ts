// Central data store: auth session, profile, uploads, answers and event
// annotations, with a demo/live mode switch.
//   demo  — the built-in sample home (CSVs through the real engine);
//           answers/annotations stay in this browser.
//   live  — "my data": a guest's local uploads (localStorage) or, when signed
//           in, uploads/answers/annotations synced to the user's account.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EvMetaEntry, Fuel, Mode, Profile } from './types'
import * as api from './lib/api'
import type { Session, UploadRecord } from './lib/api'
import { parseGreenButtonCsv, type ParsedUpload } from './lib/parse'
import { SAMPLE_BILLING, sampleUploads } from './lib/sample'
import { getForecast, type ForecastDay } from './lib/weather'

const MODE_KEY = 'hearth-mode'
const GUEST_UPLOADS_KEY = 'hearth-guest-uploads'
const DEMO_ANSWERS_KEY = 'hearth-demo-answers'
const DEMO_EVMETA_KEY = 'hearth-demo-evmeta'
const GUEST_ANSWERS_KEY = 'hearth-guest-answers'
const GUEST_EVMETA_KEY = 'hearth-guest-evmeta'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / quota */
  }
}

interface GuestUploadRow {
  fileName: string
  csv: string
  billing: { start: string; end: string } | null
}

function loadGuestUploads(): Partial<Record<Fuel, UploadRecord>> {
  const rows = readJson<GuestUploadRow[]>(GUEST_UPLOADS_KEY, [])
  const out: Partial<Record<Fuel, UploadRecord>> = {}
  for (const row of rows) {
    try {
      const parsed = parseGreenButtonCsv(row.csv, row.fileName)
      out[parsed.fuel] = { id: null, parsed, billing: row.billing }
    } catch {
      /* drop corrupt entries */
    }
  }
  return out
}

function persistGuestUploads(uploads: Partial<Record<Fuel, UploadRecord>>): void {
  const rows: GuestUploadRow[] = Object.values(uploads)
    .filter((u): u is UploadRecord => !!u)
    .map((u) => ({ fileName: u.parsed.fileName, csv: u.parsed.csv, billing: u.billing }))
  writeJson(GUEST_UPLOADS_KEY, rows)
}

export interface HearthStore {
  authReady: boolean
  session: Session | null
  profile: Profile
  mode: Mode
  setMode: (m: Mode) => void
  /** Uploads for the active mode (sample data in demo). */
  uploads: Partial<Record<Fuel, UploadRecord>>
  myUploads: Partial<Record<Fuel, UploadRecord>>
  hasMyData: boolean
  answers: Record<string, string[]>
  evMeta: Record<string, EvMetaEntry>
  forecast: ForecastDay[] | null

  signUp: (
    name: string,
    email: string,
    pw: string,
  ) => Promise<{ error?: string; needsConfirm?: boolean; alreadyRegistered?: boolean }>
  signIn: (email: string, pw: string) => Promise<{ error?: string }>
  signOutUser: () => Promise<void>
  /** True while a password-reset link's recovery session is active. */
  recovering: boolean
  requestPasswordReset: (email: string) => Promise<{ error?: string }>
  completePasswordReset: (pw: string) => Promise<{ error?: string }>
  saveProfilePatch: (patch: Partial<Profile>) => void
  commitUploads: (parsed: ParsedUpload[], billing: { start: string; end: string } | null) => Promise<void>
  removeMyUpload: (fuel: Fuel) => Promise<void>
  setAnswerValue: (key: string, vals: string[] | null) => void
  setEvMeta: (fuel: Fuel, date: string, meta: EvMetaEntry) => void
}

export function useHearthStore(): HearthStore {
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [profile, setProfile] = useState<Profile>({
    display_name: null,
    zip: null,
    home_type: null,
    ac_type: null,
    occupancy: null,
    has_ev: false,
    has_pool: false,
    has_electric_dryer: false,
  })
  const [mode, setModeState] = useState<Mode>(() => {
    const m = readJson<string | null>(MODE_KEY, null)
    return m === 'live' ? 'live' : 'demo'
  })
  const [accountUploads, setAccountUploads] = useState<Partial<Record<Fuel, UploadRecord>>>({})
  const [guestUploads, setGuestUploads] = useState<Partial<Record<Fuel, UploadRecord>>>(loadGuestUploads)
  const [accountAnswers, setAccountAnswers] = useState<Record<string, string[]>>({})
  const [accountEvMeta, setAccountEvMeta] = useState<Record<string, EvMetaEntry>>({})
  const [demoAnswers, setDemoAnswers] = useState<Record<string, string[]>>(() =>
    readJson(DEMO_ANSWERS_KEY, {}),
  )
  const [demoEvMeta, setDemoEvMeta] = useState<Record<string, EvMetaEntry>>(() =>
    readJson(DEMO_EVMETA_KEY, {}),
  )
  const [guestAnswers, setGuestAnswers] = useState<Record<string, string[]>>(() =>
    readJson(GUEST_ANSWERS_KEY, {}),
  )
  const [guestEvMeta, setGuestEvMeta] = useState<Record<string, EvMetaEntry>>(() =>
    readJson(GUEST_EVMETA_KEY, {}),
  )
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null)
  const loadedFor = useRef<string | null>(null)

  const setMode = useCallback((m: Mode) => {
    setModeState(m)
    writeJson(MODE_KEY, m)
  }, [])

  // Auth lifecycle.
  useEffect(() => {
    let cancelled = false
    api.supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session)
        setAuthReady(true)
      }
    })
    const { data: sub } = api.supabase.auth.onAuthStateChange((evt, s) => {
      // A reset link signs the user in with a recovery session; hold that flag
      // so the UI asks for a new password instead of dropping them into the app.
      if (evt === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
      setAuthReady(true)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // Load account data whenever the signed-in user changes.
  useEffect(() => {
    const userId = session?.user?.id ?? null
    if (!userId) {
      loadedFor.current = null
      setAccountUploads({})
      setAccountAnswers({})
      setAccountEvMeta({})
      return
    }
    if (loadedFor.current === userId) return
    loadedFor.current = userId
    let cancelled = false
    ;(async () => {
      const [prof, uploads, answers] = await Promise.all([
        api.fetchProfile(userId),
        api.fetchUploads(userId),
        api.fetchAnswers(userId),
      ])
      if (cancelled) return
      setProfile(prof)
      setAccountUploads(uploads)
      setAccountAnswers(answers)
      const ids: Partial<Record<Fuel, string>> = {}
      for (const [fuel, rec] of Object.entries(uploads)) {
        if (rec?.id) ids[fuel as Fuel] = rec.id
      }
      const meta = await api.fetchAnnotations(ids)
      if (!cancelled) setAccountEvMeta(meta)
      // First sign-in on this device with data: land on "my data".
      if (Object.keys(uploads).length && readJson<string | null>(MODE_KEY, null) === null) {
        setModeState('live')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  // Forecast for the profile ZIP (live mode; demo uses the canned sample).
  useEffect(() => {
    const zip = profile.zip
    if (!zip || !/^\d{5}$/.test(zip)) {
      setForecast(null)
      return
    }
    let cancelled = false
    getForecast(zip).then((f) => {
      if (!cancelled) setForecast(f)
    })
    return () => {
      cancelled = true
    }
  }, [profile.zip])

  const demoUploadsMemo = useMemo(() => {
    const { electric, gas } = sampleUploads()
    const rec = (p: ParsedUpload): UploadRecord => ({ id: null, parsed: p, billing: SAMPLE_BILLING })
    return { electric: rec(electric), gas: rec(gas) } as Partial<Record<Fuel, UploadRecord>>
  }, [])

  const isAuthed = !!session
  const myUploads = isAuthed ? accountUploads : guestUploads
  const uploads = mode === 'demo' ? demoUploadsMemo : myUploads
  const answers = mode === 'demo' ? demoAnswers : isAuthed ? accountAnswers : guestAnswers
  const evMeta = mode === 'demo' ? demoEvMeta : isAuthed ? accountEvMeta : guestEvMeta

  const setAnswerValue = useCallback(
    (key: string, vals: string[] | null) => {
      const apply = (prev: Record<string, string[]>) => {
        const next = { ...prev }
        if (vals === null || vals.length === 0) delete next[key]
        else next[key] = vals
        return next
      }
      if (mode === 'demo') {
        setDemoAnswers((prev) => {
          const next = apply(prev)
          writeJson(DEMO_ANSWERS_KEY, next)
          return next
        })
      } else if (session) {
        setAccountAnswers(apply)
        const [fuel, questionId] = key.split(':') as [Fuel, string]
        void api.saveAnswer(session.user.id, fuel, questionId, vals && vals.length ? vals : null)
      } else {
        setGuestAnswers((prev) => {
          const next = apply(prev)
          writeJson(GUEST_ANSWERS_KEY, next)
          return next
        })
      }
    },
    [mode, session],
  )

  const setEvMeta = useCallback(
    (fuel: Fuel, date: string, meta: EvMetaEntry) => {
      const key = `${fuel}:${date}`
      const apply = (prev: Record<string, EvMetaEntry>) => ({ ...prev, [key]: meta })
      if (mode === 'demo') {
        setDemoEvMeta((prev) => {
          const next = apply(prev)
          writeJson(DEMO_EVMETA_KEY, next)
          return next
        })
      } else if (session) {
        setAccountEvMeta(apply)
        const uploadId = accountUploads[fuel]?.id
        if (uploadId) void api.saveAnnotation(session.user.id, uploadId, date, meta)
      } else {
        setGuestEvMeta((prev) => {
          const next = apply(prev)
          writeJson(GUEST_EVMETA_KEY, next)
          return next
        })
      }
    },
    [mode, session, accountUploads],
  )

  const saveProfilePatch = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => ({ ...prev, ...patch }))
      if (session) void api.saveProfile(session.user.id, patch)
    },
    [session],
  )

  const commitUploads = useCallback(
    async (parsedList: ParsedUpload[], billing: { start: string; end: string } | null) => {
      if (session) {
        const next = { ...accountUploads }
        for (const parsed of parsedList) {
          const replaceId = next[parsed.fuel]?.id ?? null
          const id = await api.insertUpload(session.user.id, parsed, billing, replaceId)
          next[parsed.fuel] = { id, parsed, billing }
        }
        setAccountUploads(next)
        void api.markOnboarded(session.user.id)
      } else {
        setGuestUploads((prev) => {
          const next = { ...prev }
          for (const parsed of parsedList) next[parsed.fuel] = { id: null, parsed, billing }
          persistGuestUploads(next)
          return next
        })
      }
      if (parsedList.length) setMode('live')
    },
    [session, accountUploads, setMode],
  )

  const removeMyUpload = useCallback(
    async (fuel: Fuel) => {
      if (session) {
        const id = accountUploads[fuel]?.id
        if (id) await api.deleteUpload(id)
        setAccountUploads((prev) => {
          const next = { ...prev }
          delete next[fuel]
          return next
        })
      } else {
        setGuestUploads((prev) => {
          const next = { ...prev }
          delete next[fuel]
          persistGuestUploads(next)
          return next
        })
      }
    },
    [session, accountUploads],
  )

  const completePasswordReset = useCallback(async (pw: string) => {
    const res = await api.updatePassword(pw)
    if (!res.error) setRecovering(false)
    return res
  }, [])

  const signOutUser = useCallback(async () => {
    await api.signOut()
    setProfile({
      display_name: null,
      zip: null,
      home_type: null,
      ac_type: null,
      occupancy: null,
      has_ev: false,
      has_pool: false,
      has_electric_dryer: false,
    })
    setMode('demo')
  }, [setMode])

  return {
    authReady,
    session,
    profile,
    mode,
    setMode,
    uploads,
    myUploads,
    hasMyData: Object.keys(myUploads).length > 0,
    answers,
    evMeta,
    forecast,
    signUp: api.signUp,
    signIn: api.signIn,
    signOutUser,
    recovering,
    requestPasswordReset: api.requestPasswordReset,
    completePasswordReset,
    saveProfilePatch,
    commitUploads,
    removeMyUpload,
    setAnswerValue,
    setEvMeta,
  }
}
