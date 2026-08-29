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
import { getForecast, REFRESH_MS, type ForecastDay } from './lib/weather'

const MODE_KEY = 'hearth-mode'
const GUEST_UPLOADS_KEY = 'hearth-guest-uploads'
const DEMO_ANSWERS_KEY = 'hearth-demo-answers'
const DEMO_EVMETA_KEY = 'hearth-demo-evmeta'
const GUEST_ANSWERS_KEY = 'hearth-guest-answers'
const GUEST_EVMETA_KEY = 'hearth-guest-evmeta'
const GUEST_PROFILE_KEY = 'hearth-guest-profile'

const EMPTY_PROFILE: Profile = {
  display_name: null,
  zip: null,
  home_type: null,
  ac_type: null,
  occupancy: null,
  has_ev: false,
  has_pool: false,
  has_electric_dryer: false,
}

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
  /** When the forecast was pulled from the API. Null when there is none. */
  forecastAt: number | null
  forecastLoading: boolean
  refreshForecast: () => void

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
  /** True once this account has completed setup; setup then never reopens itself. */
  onboarded: boolean
  /** Authoritative check straight after sign-in, before the profile has loaded. */
  checkOnboarded: () => Promise<boolean>
  completeOnboarding: () => void
  deleteAllMyData: () => Promise<{ error?: string }>
  clearGuestData: () => void
  commitUploads: (parsed: ParsedUpload[], billing: { start: string; end: string } | null) => Promise<void>
  removeMyUpload: (fuel: Fuel) => Promise<void>
  setAnswerValue: (key: string, vals: string[] | null) => void
  setEvMeta: (fuel: Fuel, date: string, meta: EvMetaEntry) => void
}

export function useHearthStore(): HearthStore {
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [recovering, setRecovering] = useState(false)
  // A guest's home facts persist alongside their uploads and answers. Without
  // this the ZIP vanished on every refresh, and with it the AC playbook's
  // forecast, since a signed-out profile lives nowhere else.
  const [profile, setProfile] = useState<Profile>(() =>
    readJson<Profile>(GUEST_PROFILE_KEY, EMPTY_PROFILE),
  )
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
  const [forecastAt, setForecastAt] = useState<number | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  /** Guards against a slow earlier request landing after a newer one. */
  const forecastReq = useRef(0)
  /** The `user:zip` pair whose sign-in refresh has already been spent. */
  const forcedFor = useRef<string | null>(null)
  const [onboarded, setOnboarded] = useState(false)
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
      setOnboarded(false)
      setAccountUploads({})
      setAccountAnswers({})
      setAccountEvMeta({})
      return
    }
    if (loadedFor.current === userId) return
    loadedFor.current = userId
    let cancelled = false
    ;(async () => {
      const [prof, uploads, answers, done] = await Promise.all([
        api.fetchProfile(userId),
        api.fetchUploads(userId),
        api.fetchAnswers(userId),
        api.fetchOnboarded(userId),
      ])
      if (cancelled) return
      setProfile(prof)
      setOnboarded(done)
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
  //
  // The AC playbook is only as good as the weather behind it, so the forecast is
  // pulled on load, forced fresh at sign-in, refreshed every REFRESH_MS while a
  // tab stays open, refetched when a stale tab comes back to the foreground, and
  // available on demand from the playbook itself.
  const loadForecast = useCallback(
    async (force: boolean) => {
      const zip = profile.zip
      if (!zip || !/^\d{5}$/.test(zip)) {
        setForecast(null)
        setForecastAt(null)
        return
      }
      const req = ++forecastReq.current
      setForecastLoading(true)
      const res = await getForecast(zip, { force })
      if (req !== forecastReq.current) return // a newer request already won
      setForecastLoading(false)
      // A failed refresh keeps the numbers already on screen rather than
      // blanking the playbook; only a ZIP with no data at all clears it.
      if (res) {
        setForecast(res.days)
        setForecastAt(res.fetchedAt)
      } else if (!force) {
        setForecast(null)
        setForecastAt(null)
      }
    },
    [profile.zip],
  )

  const refreshForecast = useCallback(() => void loadForecast(true), [loadForecast])

  // One effect owns the load, so a sign-in cannot fetch twice over an empty
  // cache. It forces a fresh pull the first time a signed-in user's ZIP is
  // known, which is sign-in: the ZIP arrives with the account profile a moment
  // after the session does, so keying on the pair rather than on the auth
  // transition means the refresh has something to fetch by the time it runs.
  const signedInUser = session?.user?.id ?? null
  useEffect(() => {
    if (!signedInUser) forcedFor.current = null // so signing back in forces again
    const key = signedInUser && profile.zip ? `${signedInUser}:${profile.zip}` : null
    const force = key !== null && forcedFor.current !== key
    if (key) forcedFor.current = key
    void loadForecast(force)
  }, [signedInUser, profile.zip, loadForecast])

  useEffect(() => {
    const id = setInterval(() => void loadForecast(true), REFRESH_MS)
    // A background tab's timers are throttled and a sleeping laptop's do not
    // fire at all, so returning to the tab is the trigger that actually works.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (forecastAt !== null && Date.now() - forecastAt < REFRESH_MS) return
      void loadForecast(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadForecast, forecastAt])

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
      setProfile((prev) => {
        const next = { ...prev, ...patch }
        if (!session) writeJson(GUEST_PROFILE_KEY, next)
        return next
      })
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
        setOnboarded(true)
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

  const checkOnboarded = useCallback(async () => {
    const { data } = await api.supabase.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) return false
    const done = await api.fetchOnboarded(uid)
    setOnboarded(done)
    return done
  }, [])

  /** The wizard reached its end. Records it so it never runs itself again. */
  const completeOnboarding = useCallback(() => {
    setOnboarded(true)
    if (session) void api.markOnboarded(session.user.id)
  }, [session])

  const deleteAllMyData = useCallback(async () => {
    const uid = session?.user?.id
    if (!uid) return { error: 'Not signed in.' }
    const res = await api.deleteAllUserData(uid)
    if (res.error) return res
    setAccountUploads({})
    setAccountAnswers({})
    setAccountEvMeta({})
    setOnboarded(false)
    setProfile((p) => ({
      ...p,
      zip: null,
      home_type: null,
      ac_type: null,
      occupancy: null,
      has_ev: false,
      has_pool: false,
      has_electric_dryer: false,
    }))
    return {}
  }, [session])

  /** Wipes the guest-mode copies held in this browser. */
  const clearGuestData = useCallback(() => {
    setGuestUploads({})
    setGuestAnswers({})
    setGuestEvMeta({})
    setProfile(EMPTY_PROFILE)
    persistGuestUploads({})
    writeJson(GUEST_ANSWERS_KEY, {})
    writeJson(GUEST_EVMETA_KEY, {})
    writeJson(GUEST_PROFILE_KEY, EMPTY_PROFILE)
  }, [])

  const signOutUser = useCallback(async () => {
    await api.signOut()
    // Drop the per-tab demo flag so signing out returns to the landing page
    // rather than the sample dashboard.
    try {
      sessionStorage.removeItem('hearth-demo-visit')
    } catch {
      /* private mode */
    }
    setProfile(readJson<Profile>(GUEST_PROFILE_KEY, EMPTY_PROFILE))
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
    forecastAt,
    forecastLoading,
    refreshForecast,
    signUp: api.signUp,
    signIn: api.signIn,
    signOutUser,
    recovering,
    requestPasswordReset: api.requestPasswordReset,
    completePasswordReset,
    saveProfilePatch,
    onboarded,
    checkOnboarded,
    completeOnboarding,
    deleteAllMyData,
    clearGuestData,
    commitUploads,
    removeMyUpload,
    setAnswerValue,
    setEvMeta,
  }
}
