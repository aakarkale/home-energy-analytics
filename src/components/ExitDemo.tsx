import type { Hearth } from '../types'

// A visitor who is only here for the demo has no "you" for the profile menu to
// be about, so they get a plain way back to the homepage in its place, in red
// so it stands out as the way out. The sidebar gets a row the same size as the
// profile trigger it stands in for; the phone header gets a pill.

export function ExitDemo({ hearth, variant }: { hearth: Hearth; variant: 'row' | 'pill' }) {
  if (variant === 'pill') {
    return (
      <button
        onClick={hearth.exitDemo}
        className="h-interactive exit-demo press98"
        style={{
          height: 34,
          padding: '0 13px 0 11px',
          borderRadius: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-dm-sans)',
          fontSize: 12.5,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        <i className="ph ph-sign-out" aria-hidden="true" style={{ fontSize: 15 }} />
        Exit demo
      </button>
    )
  }

  return (
    <button
      onClick={hearth.exitDemo}
      className="h-interactive exit-demo press98"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '6px 6px',
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: 'var(--font-dm-sans)',
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'color-mix(in srgb, var(--accent-red) 16%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          color: 'var(--accent-red)',
          flex: 'none',
        }}
      >
        <i className="ph ph-sign-out" />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--accent-red)' }}>
          Exit demo
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 11,
            color: 'var(--fg-3)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Back to the homepage
        </span>
      </span>
      <i className="ph ph-arrow-right" aria-hidden="true" style={{ fontSize: 14, color: 'var(--accent-red)', flex: 'none' }} />
    </button>
  )
}
