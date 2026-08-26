// The profile menu: the one place that gathers everything about *you* rather
// than about your energy — settings, account, units, mode and signing out.
//
// Destinations are real links (`/settings`, `/account`) so they can be opened
// in a new tab and counted like any other page.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Hearth } from '../types'
import type { HearthStore } from '../store'
import { PAGE_PATHS } from '../lib/routes'

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--fg-2)',
  textAlign: 'left',
  textDecoration: 'none',
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--bg-6)', margin: '5px 0' }} />
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-5)', padding: '6px 12px 3px' }}>
      {children}
    </div>
  )
}

export function ProfileMenu({
  hearth,
  store,
  children,
  align = 'up',
  side = 'right',
}: {
  hearth: Hearth
  store: HearthStore
  /** The trigger. Rendered inside a button that toggles the menu. */
  children: ReactNode
  align?: 'up' | 'down'
  /** Which edge the panel hangs from. A narrow sidebar needs 'left' or the
   *  panel is wider than its anchor and gets cut off at the viewport edge. */
  side?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // Click-away and Escape both close it, as a menu should.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Same rule as the sidebar: with your own data on your own account, the demo
  // is only worth offering as the way back out of it.
  const showDemoToggle = hearth.mode === 'demo' || !(hearth.isAuthed && hearth.hasMyData)

  const go = (page: 'settings' | 'account') => {
    setOpen(false)
    hearth.go(page)
  }

  const link = (page: 'settings' | 'account', icon: string, label: string) => (
    <a
      href={PAGE_PATHS[page]}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        go(page)
      }}
      className="h-interactive hov-replay"
      style={itemStyle}
    >
      <i className={icon} style={{ fontSize: 16, flex: 'none' }} />
      {label}
    </a>
  )

  const action = (icon: string, label: string, onClick: () => void, danger?: boolean) => (
    <button
      onClick={() => {
        setOpen(false)
        onClick()
      }}
      className="h-interactive hov-replay"
      style={{ ...itemStyle, color: danger ? 'var(--accent-red)' : 'var(--fg-2)' }}
    >
      <i className={icon} style={{ fontSize: 16, flex: 'none' }} />
      {label}
    </button>
  )

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        className="h-interactive hov-bg3"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '6px 6px',
          borderRadius: 10,
          border: 'none',
          background: open ? 'var(--bg-3)' : 'transparent',
          cursor: 'pointer',
          fontFamily: 'var(--font-dm-sans)',
          textAlign: 'left',
        }}
      >
        {children}
      </button>

      {open && (
        <div
          role="menu"
          className="h-fade-up"
          style={{
            position: 'absolute',
            [align === 'up' ? 'bottom' : 'top']: 'calc(100% + 6px)',
            [side]: 0,
            minWidth: 236,
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 40,
            background: 'var(--bg-2)',
            border: '1px solid var(--bg-6)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-pop)',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '8px 12px 6px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', wordBreak: 'break-all' }}>
              {hearth.userLabel.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 1, wordBreak: 'break-all' }}>
              {hearth.userLabel.sub}
            </div>
          </div>
          <Divider />

          {link('account', 'ph ph-user-circle', 'Account')}
          {link('settings', 'ph ph-gear-six', 'Settings')}
          {action('ph ph-database', 'Your data', () => go('settings'))}

          <Divider />
          <SectionLabel>Quick settings</SectionLabel>

          <div style={{ ...itemStyle, cursor: 'default' }}>
            <i className="ph ph-thermometer-simple" style={{ fontSize: 16, flex: 'none' }} />
            Temperature
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 100, padding: 2 }}>
              {(['F', 'C'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => hearth.setTempUnit(u)}
                  className="h-interactive"
                  style={{
                    border: 'none',
                    borderRadius: 100,
                    padding: '2px 9px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)',
                    fontSize: 11,
                    fontWeight: 700,
                    background: hearth.tempUnit === u ? 'var(--bg-5)' : 'transparent',
                    color: hearth.tempUnit === u ? 'var(--fg-0)' : 'var(--fg-4)',
                  }}
                >
                  °{u}
                </button>
              ))}
            </span>
          </div>

          {action(
            hearth.light ? 'ph ph-moon' : 'ph ph-sun',
            hearth.light ? 'Dark theme' : 'Light theme',
            hearth.toggleTheme,
          )}

          {showDemoToggle &&
            action(
              hearth.mode === 'demo' ? 'ph ph-house' : 'ph ph-eye',
              hearth.mode === 'demo' ? 'Back to my data' : 'View the demo home',
              () => store.setMode(hearth.mode === 'demo' ? 'live' : 'demo'),
            )}

          <Divider />

          {action('ph ph-upload-simple', 'Upload a CSV', () =>
            hearth.openOb(hearth.isAuthed || hearth.hasMyData ? 2 : 0),
          )}
          {action('ph ph-question', 'How Hearth reads your bill', () => hearth.go('rates'))}

          <Divider />

          {hearth.isAuthed
            ? action('ph ph-sign-out', 'Log out', () => void store.signOutUser(), true)
            : (
              <>
                {action('ph ph-user-plus', 'Create free account', () => hearth.openOb(0, 'create'))}
                {action('ph ph-sign-in', 'Sign in', () => hearth.openOb(0, 'signin'))}
              </>
            )}
        </div>
      )}
    </div>
  )
}
