// Central data store: auth session, profile, uploads, answers and event
// annotations, with a demo/live mode switch.
//   demo  — the built-in sample home (CSVs through the real engine);
//           answers/annotations stay in this browser.
//   live  — "my data": a guest's local uploads (localStorage) or, when signed
//           in, uploads/answers/annotations synced to the user's account.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Archive, EvMetaEntry, Fuel, Mode, Profile } from './types'
import * as api from './lib/api'
import type { EmailNotice, Session, UploadRecord } from './lib/api'
import { parseGreenButtonCsv, type ParsedUpload } from './lib/parse'
import { SAMPLE_BILLING, sampleUploads } from './lib/sample'
import { getForecast, REFRESH_MS, type ForecastDay } from './lib/weather'
import { mergeUploads, reviewUpload, type UploadChoice } from './lib/merge'

const MODE_KEY = 'hearth-mode'
const GUEST_UPLOADS_KEY = 'hearth-guest-uploads'
const DEMO_ANSWERS_KEY = 'hearth-demo-answers'
const DEMO_EVMETA_KEY = 'hearth-demo-evmeta'
const GUEST_ANSWERS_KEY = 'hearth-guest-answers'
const GUEST_EVMETA_KEY = 'hearth-guest-evmeta'
const GUEST_PROFILE_KEY = 'hearth-guest-profile'
const DEMO_ARCHIVE_KEY = 'hearth-demo-archive'
const GUEST_ARCHIVE_KEY = 'hearth-guest-archive'

const NO_ARCHIVE: Archive = { answers: [], events: [] }

function readArchive(key: string): Archive {
  const a = readJson<Partial<Archive> | null>(key, null)
  return {
    answers: Array.isArray(a?.answers) ? a.answers : [],
    events: Array.isArray(a?.events) ? a.events : [],
  }
}

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

export type { EmailNotice }

export interface HearthStore {
  authReady: boolean
  session: Session | null
  emailNotice: EmailNotice | null
  clearEmailNotice: () => void
  profile: Profile
  mode: Mode
  setMode: (m: Mode) => void
  /** Uploads for the active mode (sample data in demo). */
  uploads: Partial<Record<Fuel, UploadRecord>>
  myUploads: Partial<Record<Fuel, UploadRecord>>
  /** False while a signed-in account's saved data is still loading. An upload
   *  is compared against that data before it is saved, so the comparison has
   *  to wait for it. Always true for guests, whose data is already local. */
  myDataReady: boolean
  hasMyData: boolean
  answers: Record<string, string[]>
  evMeta: Record<string, EvMetaEntry>
  archive: Archive
  forecast: ForecastDay[] | null
  /** Outdoor °F per hour from midnight local today. */
  forecastHours: number[] | null
  /** When the forecast was pulled from the API. Null when there is none. */
  forecastAt: number | null
  forecastLoading: boolean
  /** A refresh was asked for and did not come back with numbers. The old
   *  forecast stays on screen, so without this the UI would claim to be
   *  showing weather it failed to fetch. */
  forecastFailed: boolean
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
  /** Saves new files. A signed-in account merges each into its saved history
   *  for that fuel as `choices` says (keeping saved readings where they
   *  overlap, unless told otherwise); a guest's file replaces what was there. */
  commitUploads: (
    parsed: ParsedUpload[],
    billing: { start: string; end: string } | null,
    choices?: Partial<Record<Fuel, UploadChoice>>,
  ) => Promise<{ error?: string }>
  removeMyUpload: (fuel: Fuel) => Promise<void>
  setAnswerValue: (key: string, vals: string[] | null) => void
  setEvMeta: (fuel: Fuel, date: string, meta: EvMetaEntry) => void
  /** Files answers and event tags away from Calibrate, or brings them back. */
  setArchived: (change: Partial<Archive>, archived: boolean) => void
}

export function useHearthStore(): HearthStore {
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [emailNotice, setEmailNotice] = useState<EmailNotice | null>(api.emailLanding)
  const clearEmailNotice = useCallback(() => setEmailNotice(null), [])
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
  const [accountArchive, setAccountArchive] = useState<Archive>(NO_ARCHIVE)
  const [demoArchive, setDemoArchive] = useState<Archive>(() => readArchive(DEMO_ARCHIVE_KEY))
  const [guestArchive, setGuestArchive] = useState<Archive>(() => readArchive(GUEST_ARCHIVE_KEY))
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null)
  const [forecastHours, setForecastHours] = useState<number[] | null>(null)
  const [forecastAt, setForecastAt] = useState<number | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastFailed, setForecastFailed] = useState(false)
  /** Guards against a slow earlier request landing after a newer one. */
  const forecastReq = useRef(0)
  /** The `user:zip` pair whose sign-in refresh has already been spent. */
  const forcedFor = useRef<string | null>(null)
  const [onboarded, setOnboarded] = useState(false)
  const [accountLoaded, setAccountLoaded] = useState(false)
  const loadedFor = useRef<string | null>(null)

  const setMode = useCallback((m: Mode) => {
    setModeState(m)
    writeJson(MODE_KEY, m)
  }, [])

  // Auth lifecycle.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // A confirmation leaves sign-in open for the address just confirmed.
      await api.settleEmailLanding()
      const { data } = await api.supabase.auth.getSession()
      if (cancelled) return
      setSession(data.session)
      // Already signed in here: an email link has nothing to tell them.
      if (data.session) setEmailNotice(null)
      setAuthReady(true)
    })()
    const { data: sub } = api.supabase.auth.onAuthStateChange((evt, s) => {
      // Another account being signed out for a confirmation would flash its dashboard.
      if (api.settlingEmailLanding()) return
      // A reset link signs the user in with a recovery session; hold that flag
      // so the UI asks for a new password instead of dropping them into the app.
      if (evt === 'PASSWORD_RECOVERY') setRecovering(true)
      if (s) setEmailNotice(null)
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
      setAccountLoaded(false)
      setOnboarded(false)
      setAccountUploads({})
      setAccountAnswers({})
      setAccountEvMeta({})
      setAccountArchive(NO_ARCHIVE)
      return
    }
    if (loadedFor.current === userId) return
    loadedFor.current = userId
    setAccountLoaded(false)
    let cancelled = false
    let done = false
    ;(async () => {
      const [prof, uploads, answers, isOnboarded, notes] = await Promise.all([
        api.fetchProfile(userId),
        api.fetchUploads(userId),
        api.fetchAnswers(userId),
        api.fetchOnboarded(userId),
        api.fetchAnnotations(userId),
      ])
      if (cancelled) return
      const ids: Partial<Record<Fuel, string>> = {}
      for (const [fuel, rec] of Object.entries(uploads)) {
        if (rec?.id) ids[fuel as Fuel] = rec.id
      }
      const tags = api.annotationsByFuel(notes, ids)
      // One render for all of it, archive included, so nothing archived ever
      // shows on the page while the rest loads.
      setProfile(prof)
      setOnboarded(isOnboarded)
      setAccountUploads(uploads)
      setAccountLoaded(true)
      setAccountAnswers(answers.answers)
      setAccountEvMeta(tags.meta)
      setAccountArchive({ answers: answers.archived, events: tags.archived })
      // First sign-in on this device with data: land on "my data".
      if (Object.keys(uploads).length && readJson<string | null>(MODE_KEY, null) === null) {
        setModeState('live')
      }
      done = true
    })()
    return () => {
      cancelled = true
      // A session refresh can land mid-load. Let the next run fetch again
      // rather than skip a user whose data never arrived.
      if (!done) loadedFor.current = null
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
        // Bump the counter so a request already in flight for the old ZIP
        // cannot land on top of this, and clear the spinner it turned on.
        forecastReq.current++
        setForecastLoading(false)
        setForecastFailed(false)
        setForecast(null)
        setForecastHours(null)
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
        setForecastFailed(false)
        setForecast(res.days)
        setForecastHours(res.hoursF.length ? res.hoursF : null)
        setForecastAt(res.fetchedAt)
      } else if (force) {
        // Say so rather than leaving stale numbers looking freshly pulled.
        setForecastFailed(true)
      } else {
        setForecastFailed(false)
        setForecast(null)
        setForecastHours(null)
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
  const archive = mode === 'demo' ? demoArchive : isAuthed ? accountArchive : guestArchive

  /** Applies a change to this mode's archive, persisting it where the browser
   *  keeps it (an account's lives with its rows, see setArchived). */
  const updateArchive = useCallback(
    (apply: (prev: Archive) => Archive) => {
      const local = (key: string) => (prev: Archive) => {
        const next = apply(prev)
        if (next !== prev) writeJson(key, next)
        return next
      }
      if (mode === 'demo') setDemoArchive(local(DEMO_ARCHIVE_KEY))
      else if (session) setAccountArchive(apply)
      else setGuestArchive(local(GUEST_ARCHIVE_KEY))
    },
    [mode, session],
  )

  const setAnswerValue = useCallback(
    (key: string, vals: string[] | null) => {
      const apply = (prev: Record<string, string[]>) => {
        const next = { ...prev }
        if (vals === null || vals.length === 0) delete next[key]
        else next[key] = vals
        return next
      }
      // A cleared answer leaves nothing to file: its question is open again.
      if (!vals?.length) {
        updateArchive((prev) =>
          prev.answers.includes(key) ? { ...prev, answers: prev.answers.filter((k) => k !== key) } : prev,
        )
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
    [mode, session, updateArchive],
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

  const setArchived = useCallback(
    (change: Partial<Archive>, archived: boolean) => {
      updateArchive((prev) => {
        const next = { ...prev }
        for (const kind of ['answers', 'events'] as const) {
          const keys = change[kind]
          if (!keys?.length) continue
          const rest = prev[kind].filter((k) => !keys.includes(k))
          next[kind] = archived ? [...rest, ...keys] : rest
        }
        return next
      })
      if (mode === 'demo' || !session) return
      const uid = session.user.id
      if (change.answers?.length) void api.setAnswersArchived(uid, change.answers, archived)
      if (change.events?.length) {
        const ids: Partial<Record<Fuel, string>> = {}
        for (const [fuel, rec] of Object.entries(accountUploads)) {
          if (rec?.id) ids[fuel as Fuel] = rec.id
        }
        void api.setAnnotationsArchived(uid, ids, change.events, archived)
      }
    },
    [mode, session, accountUploads, updateArchive],
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
    async (
      parsedList: ParsedUpload[],
      billing: { start: string; end: string } | null,
      choices: Partial<Record<Fuel, UploadChoice>> = {},
    ): Promise<{ error?: string }> => {
      let error: string | undefined
      if (session) {
        const next = { ...accountUploads }
        for (const parsed of parsedList) {
          const saved = next[parsed.fuel]
          const choice = choices[parsed.fuel] ?? 'keep'
          const review = saved ? reviewUpload(saved.parsed, parsed) : null
          if (saved?.id && review && choice !== 'replace-all') {
            // Hourly and daily readings, or two different meters, cannot share
            // a history. Only an explicit replace may overwrite what is saved.
            if (review.blocked) continue
            // Nothing new and nothing to overwrite: the history stays as it
            // is, and only the billing cycle from this pass is saved.
            const merged =
              choice === 'keep' && review.addedDays === 0
                ? saved.parsed
                : mergeUploads(saved.parsed, parsed, choice)
            const res = await api.updateUpload(saved.id, merged, billing)
            if (res.error) {
              error = res.error
              break
            }
            next[parsed.fuel] = { id: saved.id, parsed: merged, billing }
          } else {
            const id = await api.insertUpload(session.user.id, parsed, billing, saved?.id ?? null)
            if (!id) {
              error = `Couldn't save ${parsed.fileName}. Try again in a moment.`
              break
            }
            next[parsed.fuel] = { id, parsed, billing }
          }
        }
        setAccountUploads(next)
        if (!error) {
          void api.markOnboarded(session.user.id)
          setOnboarded(true)
        }
      } else {
        setGuestUploads((prev) => {
          const next = { ...prev }
          for (const parsed of parsedList) next[parsed.fuel] = { id: null, parsed, billing }
          persistGuestUploads(next)
          return next
        })
      }
      if (parsedList.length && !error) setMode('live')
      return error ? { error } : {}
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
    setAccountArchive(NO_ARCHIVE)
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
    setGuestArchive(NO_ARCHIVE)
    setProfile(EMPTY_PROFILE)
    persistGuestUploads({})
    writeJson(GUEST_ANSWERS_KEY, {})
    writeJson(GUEST_EVMETA_KEY, {})
    writeJson(GUEST_ARCHIVE_KEY, NO_ARCHIVE)
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
    emailNotice,
    clearEmailNotice,
    profile,
    mode,
    setMode,
    uploads,
    myUploads,
    myDataReady: !session || accountLoaded,
    hasMyData: Object.keys(myUploads).length > 0,
    answers,
    evMeta,
    archive,
    forecast,
    forecastHours,
    forecastAt,
    forecastLoading,
    forecastFailed,
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
    setArchived,
  }
}
