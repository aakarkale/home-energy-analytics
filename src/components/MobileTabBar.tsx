import type { Hearth } from '../types'
import { NAV_PAGES } from '../model'

export function MobileTabBar({ hearth }: { hearth: Hearth }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 74,
        background: 'rgba(16,16,17,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--glass-12)',
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: 10,
        justifyContent: 'space-around',
      }}
    >
      {NAV_PAGES.map((nav) => {
        const active = hearth.page === nav.id
        return (
          <button
            key={nav.id}
            onClick={() => hearth.go(nav.id)}
            className="h-interactive press96"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 10,
              fontWeight: 600,
              color: active ? 'var(--fg-0)' : 'var(--fg-3)',
              padding: '4px 10px',
            }}
          >
            <i className={nav.icon} style={{ fontSize: 21 }} />
            {nav.short}
          </button>
        )
      })}
    </div>
  )
}
