// Account: who you are signed in as, and the actions that belong to the
// login itself rather than to the data (name, password, sign out).

import { useEffect, useState, type CSSProperties } from 'react'
import type { Hearth } from '../types'
import type { HearthStore } from '../store'
import { fmtDateNum } from '../lib/format'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const h2: CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }
const sub: CSSProperties = { fontSize: 12, color: 'var(--fg-4)', lineHeight: 1.5 }

const inputStyle: CSSProperties = {
  background: 'var(--bg-3)',
  border: '1px solid var(--bg-6)',
  borderRadius: 12,
  padding: '11px 14px',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 14,
  color: 'var(--fg-1)',
  width: '100%',
  boxSizing: 'border-box',
}

const ghost: CSSProperties = {
  border: '1px solid var(--bg-6)',
  background: 'transparent',
  borderRadius: 100,
  padding: '9px 16px',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--fg-2)',
}

export function Account({ hearth, store }: { hearth: Hearth; store: HearthStore }) {
  const email = store.session?.user?.email ?? ''
  const createdAt = store.session?.user?.created_at ?? null

  const [name, setName] = useState(store.profile.display_name ?? '')
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!dirty) setName(store.profile.display_name ?? '')
  }, [store.profile.display_name, dirty])

  if (!store.session) {
    return (
      <>
        <div style={card}>
          <div style={h2}>You are browsing as a guest</div>
          <div style={sub}>
            Everything you upload stays in this browser. Nothing is sent anywhere, and clearing your
            browser data removes it. Create a free account to sync across devices and keep your history.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => hearth.openOb(0, 'create')}
              className="h-interactive btn-acc press98"
              style={{ border: 'none', background: 'var(--acc,#ffdd55)', color: '#0a0a0a', borderRadius: 100, padding: '10px 20px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 700 }}
            >
              Create free account
            </button>
            <button onClick={() => hearth.openOb(0, 'signin')} className="h-interactive hov-bg3" style={ghost}>
              Sign in
            </button>
          </div>
        </div>

        <div style={card}>
          <div style={h2}>What an account adds</div>
          {[
            ['ph ph-devices', 'Your uploads and answers follow you to any device.'],
            ['ph ph-lock', 'Stored behind row-level security, readable only by you.'],
            ['ph ph-clock-counter-clockwise', 'Keep more than one billing cycle of history.'],
          ].map(([icon, text]) => (
            <div key={text} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
              <i className={icon} style={{ fontSize: 17, color: 'var(--acc,#ffdd55)', flex: 'none', marginTop: 1 }} />
              {text}
            </div>
          ))}
        </div>
      </>
    )
  }

  async function sendReset() {
    if (!email) return
    setBusy(true)
    setResetMsg(null)
    const res = await store.requestPasswordReset(email)
    setBusy(false)
    setResetMsg(res.error ? res.error : `Reset link sent to ${email}. Open it here to set a new password.`)
  }

  return (
    <>
      <div style={card}>
        <div style={h2}>Signed in</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: 'var(--bg-5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--fg-1)',
              flex: 'none',
            }}
          >
            {hearth.userLabel.initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-0)', wordBreak: 'break-all' }}>
              {email}
            </div>
            {createdAt && (
              <div style={{ ...sub, marginTop: 2 }}>
                Member since {fmtDateNum(createdAt.slice(0, 10))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={h2}>Display name</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {savedAt && <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>Saved {savedAt}</span>}
            <button
              onClick={() => {
                store.saveProfilePatch({ display_name: name.trim() || null })
                setDirty(false)
                setSavedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
              }}
              disabled={!dirty}
              className="h-interactive btn-acc press98"
              style={{ border: 'none', background: 'var(--acc,#ffdd55)', color: '#0a0a0a', borderRadius: 100, padding: '8px 18px', cursor: dirty ? 'pointer' : 'default', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 700, opacity: dirty ? 1 : 0.5 }}
            >
              Save
            </button>
          </div>
        </div>
        <div style={sub}>Used for the greeting on your dashboard.</div>
        <input
          value={name}
          placeholder="Your name"
          onChange={(e) => {
            setDirty(true)
            setName(e.target.value)
          }}
          autoComplete="name"
          style={{ ...inputStyle, maxWidth: 320 }}
        />
      </div>

      <div style={card}>
        <div style={h2}>Password</div>
        <div style={sub}>
          We send a reset link to {email}. Opening it brings you back here to choose a new password.
        </div>
        {resetMsg && (
          <div style={{ fontSize: 12, color: resetMsg.startsWith('Reset link') ? 'var(--accent-green)' : 'var(--accent-red)', lineHeight: 1.5 }}>
            {resetMsg}
          </div>
        )}
        <div>
          <button onClick={() => void sendReset()} disabled={busy} className="h-interactive hov-bg3" style={ghost}>
            <i className="ph ph-key" style={{ marginRight: 7 }} />
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={h2}>Session</div>
        <div style={sub}>
          Signing out returns you to the marketing page. Your data stays on your account.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => void store.signOutUser()} className="h-interactive hov-bg3" style={ghost}>
            <i className="ph ph-sign-out" style={{ marginRight: 7 }} />
            Log out
          </button>
          <button onClick={() => hearth.go('settings')} className="h-interactive hov-bg3" style={ghost}>
            <i className="ph ph-database" style={{ marginRight: 7 }} />
            Manage my data
          </button>
        </div>
      </div>
    </>
  )
}
