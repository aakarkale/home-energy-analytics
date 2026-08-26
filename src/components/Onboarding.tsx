import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Hearth, ObTab, Profile } from '../types'
import type { HearthStore } from '../store'
import { parseGreenButtonCsv, ParseError, type DateOrder, type ParsedUpload } from '../lib/parse'
import { analyzeFuel } from '../lib/analyze'
import { fmtDateNum, fmtMoney0 } from '../lib/format'
import { FUEL_ICON } from '../model'

const OB_TITLES = ['Welcome to Hearth', 'Your home', 'Your data', 'Billing cycle']

const OB_TABS: { id: ObTab; label: string }[] = [
  { id: 'create', label: 'Create account' },
  { id: 'signin', label: 'Sign in' },
]

interface Facts {
  zip: string
  ac: string | null
  occ: string | null
  home: string | null
  extras: Record<string, boolean>
}

const OB_GROUPS: { key: 'ac' | 'occ' | 'home' | 'extras'; label: string; why: string; opts: string[]; multi?: boolean }[] = [
  {
    key: 'ac',
    label: 'AC type',
    why: 'Tailors the AC Playbook, or hides it if you have no AC.',
    opts: ['Central AC', 'Heat pump', 'Window / portable', 'No AC'],
  },
  {
    key: 'occ',
    label: 'Typical weekday',
    why: 'Helps read quiet days and your daytime baseline.',
    opts: ['Someone home all day', 'Away 9–5', 'Varies'],
  },
  {
    key: 'home',
    label: 'Home type',
    why: 'Sets fair benchmarks for always-on load.',
    opts: ['House', 'Townhouse', 'Apartment / condo'],
  },
  {
    key: 'extras',
    label: 'Also true for us',
    why: 'Adds targeted questions and tips for these loads.',
    opts: ['EV', 'Pool', 'Electric dryer'],
    multi: true,
  },
]

function factsFromProfile(p: Profile): Facts {
  return {
    zip: p.zip ?? '',
    ac: p.ac_type,
    occ: p.occupancy,
    home: p.home_type,
    extras: { EV: p.has_ev, Pool: p.has_pool, 'Electric dryer': p.has_electric_dryer },
  }
}

const inputStyle: CSSProperties = {
  background: 'var(--bg-3)',
  border: '1px solid var(--bg-6)',
  borderRadius: 12,
  padding: '11px 14px',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 14,
  color: 'var(--fg-1)',
}

const backBtn: CSSProperties = {
  padding: '11px 18px',
  borderRadius: 100,
  border: '1px solid var(--bg-6)',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 13,
  fontWeight: 600,
  background: 'transparent',
  color: 'var(--fg-2)',
}

const ctaBtn: CSSProperties = {
  padding: 11,
  borderRadius: 100,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 14,
  fontWeight: 700,
  background: 'var(--acc,#ffdd55)',
  color: '#0a0a0a',
}

const noteStyle: CSSProperties = { fontSize: 12, color: 'var(--fg-4)', marginTop: -8, lineHeight: 1.5 }

export function Onboarding({
  hearth,
  store,
  initialTab = 'create',
}: {
  hearth: Hearth
  store: HearthStore
  initialTab?: ObTab
}) {
  const { obStep } = hearth

  const [tab, setTab] = useState<ObTab>(initialTab)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')

  const [facts, setFacts] = useState<Facts>(() => factsFromProfile(store.profile))
  const factsDirty = useRef(false)
  useEffect(() => {
    if (!factsDirty.current) setFacts(factsFromProfile(store.profile))
  }, [store.profile])

  const [parsed, setParsed] = useState<ParsedUpload[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [billing, setBilling] = useState<{ start: string; end: string } | null>(null)
  const [finishing, setFinishing] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!parsed.length) {
      setBilling(null)
      return
    }
    const start = parsed.map((p) => p.periodStart).sort()[0]
    const end = parsed
      .map((p) => p.periodEnd)
      .sort()
      .at(-1)!
    setBilling((prev) => prev ?? { start, end })
  }, [parsed])

  const summary = useMemo(() => {
    if (!parsed.length || !billing) return null
    const primary = parsed.find((p) => p.fuel === 'electric') ?? parsed[0]
    const a = analyzeFuel(primary, billing)
    return a.projection
      ? {
          length: `${a.projection.cycleDays} days`,
          covers: `${Math.max(1, Math.round((a.days / a.projection.cycleDays) * 10) / 10)} cycle${a.days > a.projection.cycleDays * 1.5 ? 's' : ''}`,
          projected: fmtMoney0(a.projection.projected),
        }
      : null
  }, [parsed, billing])

  async function handleFiles(files: FileList | File[]) {
    const errs: string[] = []
    const additions: ParsedUpload[] = []
    for (const file of Array.from(files)) {
      try {
        const text = await file.text()
        additions.push(parseGreenButtonCsv(text, file.name))
      } catch (e) {
        errs.push(`${file.name}: ${e instanceof ParseError ? e.message : 'could not read this file.'}`)
      }
    }
    setParsed((prev) => {
      const next = [...prev]
      for (const add of additions) {
        const i = next.findIndex((p) => p.fuel === add.fuel)
        if (i >= 0) next[i] = add
        else next.push(add)
      }
      return next
    })
    setParseErrors(errs)
  }

  /** Re-read one ambiguous file in the order the user picked. */
  function resolveDateOrder(target: ParsedUpload, order: DateOrder) {
    setParsed((prev) =>
      prev.map((p) => {
        if (p.fuel !== target.fuel) return p
        try {
          return parseGreenButtonCsv(p.csv, p.fileName, order)
        } catch {
          return p
        }
      }),
    )
    // The billing window was derived from the old reading; rebuild it.
    setBilling(null)
  }

  async function submitAuth() {
    setAuthBusy(true)
    setAuthError(null)
    setNotice(null)
    if (tab === 'create') {
      const res = await store.signUp(name.trim(), email.trim(), password)
      setAuthBusy(false)
      if (res.error) setAuthError(res.error)
      else if (res.alreadyRegistered) {
        // No confirmation email goes out for an address that already exists,
        // so send them to sign-in rather than to an inbox with nothing in it.
        setTab('signin')
        setNotice('That email already has an account. Sign in below, or reset your password.')
      } else if (res.needsConfirm) {
        setTab('signin')
        setNotice('Check your inbox: confirm your email, then sign in here.')
      } else {
        store.setMode('live')
        hearth.obNext()
      }
    } else {
      const res = await store.signIn(email.trim(), password)
      if (res.error) {
        setAuthBusy(false)
        setAuthError(res.error)
        return
      }
      // Signing in shows your own data, never a leftover demo session.
      store.setMode('live')
      // Setup runs once per account. A returning user goes straight to their
      // dashboard; home facts are editable later under Settings.
      const done = await store.checkOnboarded()
      setAuthBusy(false)
      if (done) hearth.closeOb()
      else hearth.obNext()
    }
  }

  async function sendReset() {
    if (!email.trim()) {
      setAuthError('Enter your email address first, then choose Forgot password.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    setNotice(null)
    const res = await store.requestPasswordReset(email.trim())
    setAuthBusy(false)
    if (res.error) setAuthError(res.error)
    else setNotice(`Reset link sent to ${email.trim()}. Open it here to set a new password.`)
  }

  async function submitNewPassword() {
    setAuthBusy(true)
    setAuthError(null)
    const res = await store.completePasswordReset(newPw)
    setAuthBusy(false)
    if (res.error) setAuthError(res.error)
    else {
      setNewPw('')
      hearth.obNext()
    }
  }

  function saveFacts() {
    store.saveProfilePatch({
      zip: facts.zip.trim() || null,
      ac_type: facts.ac,
      occupancy: facts.occ,
      home_type: facts.home,
      has_ev: !!facts.extras['EV'],
      has_pool: !!facts.extras['Pool'],
      has_electric_dryer: !!facts.extras['Electric dryer'],
    })
  }

  async function finish() {
    if (parsed.length) {
      setFinishing(true)
      await store.commitUploads(parsed, billing)
      setFinishing(false)
    }
    // Reaching the end is what makes setup done, file or no file. From here on
    // the same fields live in Settings.
    store.completeOnboarding()
    hearth.closeOb()
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(9,9,9,0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '100%',
          overflowY: 'auto',
          background: 'var(--bg-2)',
          border: '1px solid var(--bg-6)',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'var(--acc,#ffdd55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0a0a0a',
              fontSize: 14,
            }}
          >
            <i className="ph-fill ph-lightning" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>{OB_TITLES[obStep]}</div>
          <button
            onClick={hearth.closeOb}
            className="h-interactive hov-fg0"
            style={{
              marginLeft: 'auto',
              width: 28,
              height: 28,
              borderRadius: 100,
              border: 'none',
              background: 'var(--bg-4)',
              color: 'var(--fg-3)',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="ph ph-x" />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ flex: 1, height: 4, borderRadius: 100, background: i <= obStep ? 'var(--acc,#ffdd55)' : 'var(--bg-5)' }}
            />
          ))}
        </div>

        {store.recovering && (
          <>
            <div style={noteStyle}>
              You opened a password reset link. Choose a new password and you'll be signed in.
            </div>
            <input
              placeholder="New password (8+ characters)"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newPw.length >= 8 && !authBusy) void submitNewPassword()
              }}
              style={inputStyle}
            />
            {authError && (
              <div style={{ fontSize: 12, color: 'var(--accent-red)', lineHeight: 1.4, marginTop: -8 }}>{authError}</div>
            )}
            <button
              onClick={() => void submitNewPassword()}
              disabled={authBusy || newPw.length < 8}
              className="h-interactive btn-acc press98"
              style={{ ...ctaBtn, padding: 12, opacity: authBusy || newPw.length < 8 ? 0.55 : 1 }}
            >
              {authBusy ? 'One moment…' : 'Set new password'}
            </button>
          </>
        )}

        {!store.recovering && obStep === 0 && hearth.isAuthed && (
          <>
            <div style={noteStyle}>
              Signed in as <b style={{ color: 'var(--fg-2)' }}>{store.session?.user?.email}</b>. Your
              uploads, answers and home facts sync to this account.
            </div>
            <button onClick={hearth.obNext} className="h-interactive btn-acc press98" style={{ ...ctaBtn, padding: 12 }}>
              Continue
            </button>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  store.setMode('demo')
                  hearth.closeOb()
                }}
                className="h-interactive hov-fg1"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-3)', padding: 0 }}
              >
                Explore the demo →
              </button>
              <button
                onClick={() => void store.signOutUser()}
                className="h-interactive hov-fg1"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-3)', padding: 0 }}
              >
                Sign out
              </button>
            </div>
          </>
        )}

        {!store.recovering && obStep === 0 && !hearth.isAuthed && (
          <>
            <div style={noteStyle}>
              An account keeps your data and answers synced across devices. Or explore the demo first,
              no sign-up needed.
            </div>
            <div style={{ display: 'flex', background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 100, padding: 3, gap: 2 }}>
              {OB_TABS.map((t) => {
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTab(t.id)
                      setAuthError(null)
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 100,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans)',
                      fontSize: 13,
                      fontWeight: 600,
                      background: active ? 'var(--bg-5)' : 'transparent',
                      color: active ? 'var(--fg-0)' : 'var(--fg-4)',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            {notice && (
              <div style={{ fontSize: 12, color: 'var(--accent-green)', lineHeight: 1.5, background: 'rgba(4,196,10,0.12)', borderRadius: 12, padding: '10px 14px' }}>
                {notice}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tab === 'create' && (
                <input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  style={inputStyle}
                />
              )}
              <input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                style={inputStyle}
              />
              <input
                placeholder="Password (8+ characters)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'create' ? 'new-password' : 'current-password'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && email && password.length >= 8 && !authBusy) void submitAuth()
                }}
                style={inputStyle}
              />
            </div>
            {authError && (
              <div style={{ fontSize: 12, color: 'var(--accent-red)', lineHeight: 1.4, marginTop: -8 }}>{authError}</div>
            )}
            <button
              onClick={() => void submitAuth()}
              disabled={authBusy || !email || password.length < 8 || (tab === 'create' && !name.trim())}
              className="h-interactive btn-acc press98"
              style={{ ...ctaBtn, padding: 12, opacity: authBusy || !email || password.length < 8 || (tab === 'create' && !name.trim()) ? 0.55 : 1 }}
            >
              {authBusy ? 'One moment…' : tab === 'create' ? 'Create account' : 'Sign in'}
            </button>
            {tab === 'signin' && (
              <button
                onClick={() => void sendReset()}
                disabled={authBusy}
                className="h-interactive hov-fg1"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-4)', padding: 0, marginTop: -4 }}
              >
                Forgot password?
              </button>
            )}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={hearth.obNext}
                className="h-interactive hov-fg1"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-3)', padding: 0 }}
              >
                Continue without an account →
              </button>
              <button
                onClick={() => {
                  store.setMode('demo')
                  hearth.closeOb()
                }}
                className="h-interactive hov-fg1"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-3)', padding: 0 }}
              >
                Browse the demo
              </button>
            </div>
          </>
        )}

        {obStep === 1 && (
          <>
            <div style={noteStyle}>
              Optional. Each answer changes what Hearth asks and suggests. Skip anything.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                ZIP code
              </div>
              <input
                placeholder="ZIP code"
                maxLength={5}
                value={facts.zip}
                onChange={(e) => {
                  factsDirty.current = true
                  setFacts((f) => ({ ...f, zip: e.target.value.replace(/\D/g, '') }))
                }}
                inputMode="numeric"
                style={{ ...inputStyle, width: 140 }}
              />
              <div style={{ fontSize: 11, color: 'var(--fg-4)', lineHeight: 1.4 }}>
                Powers the live 7-day forecast and night-flush advice in your AC Playbook.
              </div>
            </div>
            {OB_GROUPS.map((g) => (
              <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                  {g.label}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {g.opts.map((o) => {
                    const on = g.multi ? !!facts.extras[o] : facts[g.key as 'ac' | 'occ' | 'home'] === o
                    return (
                      <button
                        key={o}
                        onClick={() => {
                          factsDirty.current = true
                          setFacts((f) => {
                            if (g.multi) return { ...f, extras: { ...f.extras, [o]: !f.extras[o] } }
                            const key = g.key as 'ac' | 'occ' | 'home'
                            return { ...f, [key]: f[key] === o ? null : o }
                          })
                        }}
                        className="h-interactive press97"
                        style={{
                          padding: '7px 13px',
                          borderRadius: 100,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-dm-sans)',
                          fontSize: 12,
                          fontWeight: 600,
                          border: `1px solid ${on ? hearth.acc : 'var(--bg-6)'}`,
                          background: on ? hearth.acc : 'var(--bg-3)',
                          color: on ? '#0a0a0a' : 'var(--fg-2)',
                        }}
                      >
                        {o}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', lineHeight: 1.4 }}>{g.why}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={hearth.obBack} className="h-interactive hov-bg3" style={backBtn}>
                Back
              </button>
              <button
                onClick={() => {
                  saveFacts()
                  hearth.obNext()
                }}
                className="h-interactive btn-acc"
                style={{ ...ctaBtn, flex: 1 }}
              >
                Continue
              </button>
            </div>
            <button
              onClick={hearth.obNext}
              className="h-interactive hov-fg2"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--fg-4)', padding: 0 }}
            >
              Skip for now
            </button>
          </>
        )}

        {obStep === 2 && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <div
              className="h-interactive dropzone"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
              }}
              style={{
                border: '1.5px dashed var(--fg-5)',
                borderRadius: 16,
                padding: '34px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <i className="ph ph-file-arrow-up" style={{ fontSize: 30, color: 'var(--fg-3)' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>Drop your PG&amp;E CSVs here</div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                or click to browse · electric and gas can arrive separately
              </div>
            </div>

            {parsed.map((p) => (
              <div
                key={p.fuel}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)' }}
              >
                <i className={FUEL_ICON[p.fuel].icon} style={{ fontSize: 17, color: FUEL_ICON[p.fuel].color, flex: 'none' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.fileName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>
                    {p.fuel} · {p.granularity} · {p.rowCount} rows · {fmtDateNum(p.periodStart)} – {fmtDateNum(p.periodEnd)}
                  </div>
                </div>
                <button
                  onClick={() => setParsed((prev) => prev.filter((x) => x.fuel !== p.fuel))}
                  className="h-interactive hov-fg0"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--fg-4)', fontSize: 14, padding: 4 }}
                >
                  <i className="ph ph-x" />
                </button>
              </div>
            ))}
            {parsed.filter((p) => p.dateAmbiguous).map((p) => (
              <div
                key={`amb-${p.fuel}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '11px 13px', borderRadius: 12, background: 'rgba(255,221,85,0.09)', border: '1px solid rgba(255,221,85,0.3)' }}
              >
                <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                  Every date in <b style={{ color: 'var(--fg-1)' }}>{p.fileName}</b> reads validly both
                  ways, so we can't tell the order from the file. Which is it?
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['mdy', 'dmy'] as const).map((ord) => (
                    <button
                      key={ord}
                      onClick={() => resolveDateOrder(p, ord)}
                      className="h-interactive chip press97"
                      style={{
                        padding: '7px 13px',
                        borderRadius: 100,
                        border: `1px solid ${p.dateOrder === ord ? 'var(--acc,#ffdd55)' : 'var(--bg-6)'}`,
                        background: 'var(--bg-4)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-dm-sans)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--fg-1)',
                      }}
                    >
                      {ord === 'mdy' ? 'mm/dd/yyyy' : 'dd/mm/yyyy'}
                      <span style={{ color: 'var(--fg-4)', fontWeight: 500, marginLeft: 6 }}>
                        {ord === 'mdy' ? 'US' : 'day first'}
                      </span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                  Reading it as {p.dateOrder === 'mdy' ? 'mm/dd/yyyy' : 'dd/mm/yyyy'} gives{' '}
                  {fmtDateNum(p.periodStart)} – {fmtDateNum(p.periodEnd)}.
                </div>
              </div>
            ))}
            {parseErrors.map((err) => (
              <div key={err} style={{ fontSize: 12, color: 'var(--accent-red)', lineHeight: 1.4 }}>
                {err}
              </div>
            ))}

            <div style={{ fontSize: 12, color: 'var(--fg-4)', lineHeight: 1.5 }}>
              Get the file from pge.com → Energy Usage Details →{' '}
              <b style={{ color: 'var(--fg-2)' }}>Green Button · Download my data</b>. Your data never
              leaves this device until you finish setup{hearth.isAuthed ? ', then it saves to your account' : ''}.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={hearth.obBack} className="h-interactive hov-bg3" style={backBtn}>
                Back
              </button>
              {parsed.length ? (
                <button onClick={hearth.obNext} className="h-interactive btn-acc" style={{ ...ctaBtn, flex: 1 }}>
                  Continue
                </button>
              ) : hearth.hasMyData ? (
                <button onClick={hearth.obNext} className="h-interactive btn-acc" style={{ ...ctaBtn, flex: 1 }}>
                  Keep current data
                </button>
              ) : (
                <button
                  onClick={() => {
                    store.setMode('demo')
                    hearth.closeOb()
                  }}
                  className="h-interactive btn-acc"
                  style={{ ...ctaBtn, flex: 1 }}
                >
                  Use sample data instead
                </button>
              )}
            </div>
          </>
        )}

        {obStep === 3 && (
          <>
            {parsed.length && billing ? (
              <>
                <div style={noteStyle}>
                  We pre-filled this from your file. Adjust if your PG&amp;E statement cycle differs.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                      Cycle starts
                    </div>
                    <input
                      type="date"
                      value={billing.start}
                      onChange={(e) => setBilling((b) => (b ? { ...b, start: e.target.value } : b))}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--fg-4)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDateNum(billing.start)} <span style={{ color: 'var(--fg-5)' }}>mm/dd/yyyy</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                      Cycle ends
                    </div>
                    <input
                      type="date"
                      value={billing.end}
                      onChange={(e) => setBilling((b) => (b ? { ...b, end: e.target.value } : b))}
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--fg-4)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDateNum(billing.end)} <span style={{ color: 'var(--fg-5)' }}>mm/dd/yyyy</span>
                    </div>
                  </div>
                </div>
                {summary && (
                  <div style={{ borderRadius: 14, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '14px 16px', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>LENGTH</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)', marginTop: 3 }}>{summary.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>COVERS</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)', marginTop: 3 }}>{summary.covers}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>PROJECTED</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)', marginTop: 3 }}>{summary.projected}</div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={noteStyle}>No new files this time, so your current data stays as is.</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={hearth.obBack} className="h-interactive hov-bg3" style={backBtn}>
                Back
              </button>
              <button
                onClick={() => void finish()}
                disabled={finishing}
                className="h-interactive btn-acc"
                style={{ ...ctaBtn, flex: 1, opacity: finishing ? 0.55 : 1 }}
              >
                {finishing ? 'Saving…' : 'Finish setup'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
