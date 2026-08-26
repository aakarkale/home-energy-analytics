import type { Hearth } from '../types'
import type { HearthStore } from '../store'
import { ProfileMenu } from './ProfileMenu'
import { FUEL_TABS, PAGE_TITLES } from '../model'

function FuelTabs({ hearth, mobile }: { hearth: Hearth; mobile: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-3)',
        border: '1px solid var(--bg-6)',
        borderRadius: 100,
        padding: 3,
        gap: 2,
        ...(mobile ? { width: '100%' } : { flex: 'none' }),
      }}
    >
      {FUEL_TABS.map((ft) => {
        const active = hearth.fuel === ft.id
        const hasData = !!hearth.bundles[ft.id]
        return (
          <button
            key={ft.id}
            onClick={() => hearth.setFuel(ft.id)}
            title={hasData ? undefined : 'No data uploaded for this fuel yet'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 100,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              background: active ? 'var(--bg-5)' : 'transparent',
              color: active ? ft.activeFg : 'var(--fg-4)',
              opacity: hasData || active ? 1 : 0.6,
              ...(mobile
                ? { flex: 1, justifyContent: 'center', padding: '7px 12px' }
                : { padding: '6px 12px' }),
            }}
          >
            <i className={ft.icon} style={{ fontSize: 14 }} />
            {ft.label}
          </button>
        )
      })}
    </div>
  )
}

export function Header({ hearth, store }: { hearth: Hearth; store: HearthStore }) {
  const { isMobile, isDesktop } = hearth
  const themeIcon = hearth.light ? 'ph ph-moon' : 'ph ph-sun'
  const themeLabel = hearth.light ? 'Dark mode' : 'Light mode'
  const title = hearth.page === 'overview' ? hearth.greeting : PAGE_TITLES[hearth.page]
  const uploadStep = hearth.isAuthed || hearth.hasMyData ? 2 : 0
  // Settings and Account are not per-fuel views, so the fuel switch would only
  // change something you cannot see from here.
  const showFuel = hearth.page !== 'settings' && hearth.page !== 'account'

  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: isMobile ? '14px 16px' : '18px 28px',
        borderBottom: '1px solid var(--bg-6)',
      }}
    >
      {isMobile && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--acc,#ffdd55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0a0a0a',
            fontSize: 15,
            flex: 'none',
          }}
        >
          <i className="ph-fill ph-lightning" />
        </div>
      )}

      <div style={{ minWidth: 0, marginRight: 'auto' }}>
        <div
          style={{
            fontSize: isMobile ? 17 : 20,
            fontWeight: 700,
            color: 'var(--fg-0)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {title}
          {isMobile && hearth.mode === 'demo' && (
            <span
              style={{
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
        <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 5 }}>{hearth.subtitle}</div>
      </div>

      {isDesktop && (
        <>
          {showFuel && <FuelTabs hearth={hearth} mobile={false} />}
          <button
            onClick={() => hearth.openOb(uploadStep)}
            className="h-interactive btn-acc press98"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 16px',
              borderRadius: 100,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 13,
              fontWeight: 700,
              background: 'var(--acc,#ffdd55)',
              color: '#0a0a0a',
              flex: 'none',
            }}
          >
            <i className="ph ph-plus" style={{ fontSize: 14 }} />
            Upload CSV
          </button>
          <button
            onClick={hearth.toggleTheme}
            title={themeLabel}
            className="h-interactive hov-theme press98"
            style={{
              width: 34,
              height: 34,
              borderRadius: 100,
              border: '1px solid var(--bg-6)',
              cursor: 'pointer',
              background: 'var(--bg-3)',
              color: 'var(--fg-2)',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <i className={themeIcon} />
          </button>
        </>
      )}

      {isMobile && (
        <>
          <ProfileMenu hearth={hearth} store={store} align="down">
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 100,
                border: '1px solid var(--glass-12)',
                background: 'var(--glass-11)',
                color: 'var(--fg-1)',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              {hearth.userLabel.initials}
            </span>
          </ProfileMenu>
          <button
            onClick={() => hearth.openOb(uploadStep)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 100,
              border: '1px solid var(--glass-12)',
              cursor: 'pointer',
              background: 'var(--glass-11)',
              color: 'var(--fg-1)',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <i className="ph ph-plus" />
          </button>
          {showFuel && <FuelTabs hearth={hearth} mobile />}
        </>
      )}
    </div>
  )
}
