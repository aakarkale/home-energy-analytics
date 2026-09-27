import type { CSSProperties } from 'react'
import type { EmailNotice } from '../store'

// What sign-in says after an email link: a celebration when the address has
// just been confirmed, and a plain explanation when the link was already used
// (confirmation links work once) or has expired.

/** The burst, fixed rather than random so it looks the same every time. */
const PIECES = Array.from({ length: 18 }, (_, i) => {
  const angle = ((i * 20 + (i % 3) * 7) * Math.PI) / 180
  const reach = 32 + ((i * 37) % 23)
  const colours = [
    'var(--accent-green)',
    'var(--accent-yellow)',
    'var(--accent-blue)',
    'var(--accent-coral)',
    'var(--accent-lavender)',
    'var(--accent-violet)',
  ]
  const dot = i % 3 === 0
  return {
    dx: `${Math.round(Math.cos(angle) * reach)}px`,
    dy: `${Math.round(Math.sin(angle) * reach)}px`,
    spin: `${(i % 2 ? 1 : -1) * (160 + ((i * 53) % 200))}deg`,
    width: dot ? 5 : 7,
    height: dot ? 5 : 3,
    radius: dot ? 100 : 1,
    colour: colours[i % colours.length],
    delay: `${240 + (i % 4) * 25}ms`,
  }
})

export function EmailLinkNotice({ notice }: { notice: EmailNotice }) {
  if (notice.kind === 'link-spent') {
    return (
      <div
        role="status"
        style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 14, background: 'var(--bg-3)', border: '1px solid var(--bg-6)' }}
      >
        <i className="ph-fill ph-info" aria-hidden="true" style={{ fontSize: 18, color: 'var(--fg-3)', flex: 'none', marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>That link has expired or was already used</div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5, marginTop: 2 }}>
            Confirmation links work once. If you've already confirmed your email, just sign in below.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="status"
      className="h-confirm"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 14px',
        borderRadius: 14,
        background: 'color-mix(in srgb, var(--accent-green) 11%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent-green) 38%, transparent)',
      }}
    >
      <span
        className="h-confirm-badge"
        aria-hidden="true"
        style={{ position: 'relative', width: 36, height: 36, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <span
          className="h-confirm-ring"
          style={{ position: 'absolute', inset: 2, borderRadius: 100, border: '2px solid var(--accent-green)' }}
        />
        <i className="ph-fill ph-seal-check" style={{ position: 'relative', fontSize: 36, color: 'var(--accent-green)' }} />
        {PIECES.map((p, i) => (
          <span
            key={i}
            className="h-confetti"
            style={
              {
                '--dx': p.dx,
                '--dy': p.dy,
                '--spin': p.spin,
                width: p.width,
                height: p.height,
                borderRadius: p.radius,
                background: p.colour,
                animationDelay: p.delay,
              } as CSSProperties
            }
          />
        ))}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: '-0.01em' }}>
          Email address confirmed
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.45, marginTop: 2 }}>
          You're all set. Sign in to open your dashboard.
        </div>
      </div>
    </div>
  )
}
