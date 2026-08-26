import type { Hearth } from '../types'
import type { HearthStore } from '../store'
import { PAGE_PATHS } from '../lib/routes'
import { ProfileMenu } from './ProfileMenu'
import { NAV_PAGES } from '../model'

export function Sidebar({ hearth, store }: { hearth: Hearth; store: HearthStore }) {
  const { mode, isAuthed, hasMyData, onboarded } = hearth

  // Once it is your own home on your own account, sample data is clutter. The
  // toggle only survives as the way back out of demo mode.
  const settled = isAuthed && hasMyData
  const showDemoToggle = mode === 'demo' || !settled
  // Setup runs once per account. After that, home facts live in Settings and
  // new files go through the upload step, so replaying the wizard is noise.
  const showReplay = !(isAuthed && onboarded)
  return (
    <div
      style={{
        width: 220,
        flex: 'none',
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--bg-6)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 12px',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 18px' }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: 'var(--acc,#ffdd55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0a0a0a',
            fontSize: 17,
          }}
        >
          <i className="ph-fill ph-lightning" />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.01em' }}>
          Hearth
        </div>
        {mode === 'demo' && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.05em',
              color: 'var(--acc,#ffdd55)',
              background: 'var(--accSoft,rgba(255,221,85,.13))',
              borderRadius: 100,
              padding: '3px 8px',
            }}
          >
            DEMO
          </span>
        )}
      </div>

      {NAV_PAGES.map((nav) => {
        const active = hearth.page === nav.id
        return (
          <a
            key={nav.id}
            href={PAGE_PATHS[nav.id]}
            onClick={(e) => {
              // Let the browser handle modified clicks (new tab, new window).
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
              e.preventDefault()
              hearth.go(nav.id)
            }}
            aria-current={active ? 'page' : undefined}
            className="h-interactive hov-fg0"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              textAlign: 'left',
              textDecoration: 'none',
              background: active ? 'var(--bg-4)' : 'transparent',
              color: active ? 'var(--fg-0)' : 'var(--fg-3)',
            }}
          >
            <i className={nav.icon} style={{ fontSize: 18 }} />
            {nav.label}
          </a>
        )
      })}

      <div style={{ flex: 1 }} />

      {mode === 'demo' && !isAuthed && (
        <button
          onClick={() => hearth.openOb(0)}
          className="h-interactive btn-acc press98"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px',
            borderRadius: 100,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 13,
            fontWeight: 700,
            background: 'var(--acc,#ffdd55)',
            color: '#0a0a0a',
            marginBottom: 4,
          }}
        >
          Create free account
        </button>
      )}
      {(isAuthed || hasMyData) && showDemoToggle && (
        <button
          onClick={() => hearth.setMode(mode === 'demo' ? 'live' : 'demo')}
          className="h-interactive hov-replay"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 10px',
            borderRadius: 10,
            border: '1px solid var(--bg-6)',
            cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 13,
            fontWeight: 500,
            background: 'transparent',
            color: 'var(--fg-3)',
          }}
        >
          <i className={mode === 'demo' ? 'ph ph-arrow-u-up-left' : 'ph ph-eye'} style={{ fontSize: 16 }} />
          {mode === 'demo' ? 'Back to my data' : 'View demo'}
        </button>
      )}
      {showReplay && (
        <button
          onClick={() => hearth.openOb(0)}
          className="h-interactive hov-replay"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 10px',
            borderRadius: 10,
            border: '1px solid var(--bg-6)',
            cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 13,
            fontWeight: 500,
            background: 'transparent',
            color: 'var(--fg-3)',
          }}
        >
          <i className="ph ph-sparkle" style={{ fontSize: 16 }} />
          Replay setup
        </button>
      )}

      <div style={{ borderTop: '1px solid var(--bg-6)', marginTop: 10, paddingTop: 8 }}>
        <ProfileMenu hearth={hearth} store={store} side="left">
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--bg-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--fg-1)',
            flex: 'none',
          }}
        >
          {hearth.userLabel.initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--fg-1)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {hearth.userLabel.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--fg-4)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {hearth.userLabel.sub}
          </div>
        </div>
        <i className="ph ph-caret-up-down" style={{ fontSize: 14, color: 'var(--fg-4)', flex: 'none' }} />
        </ProfileMenu>
      </div>
    </div>
  )
}
