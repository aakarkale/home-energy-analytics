import type { Hearth } from '../types'

/** Shown in live mode when the current fuel has no upload yet. */
export function EmptyState({ hearth }: { hearth: Hearth }) {
  const fuelName = hearth.elec ? 'electricity' : 'gas'
  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--bg-6)',
        borderRadius: 16,
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: 'var(--accSoft,rgba(255,221,85,.13))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
          color: 'var(--acc,#ffdd55)',
        }}
      >
        <i className={hearth.elec ? 'ph-fill ph-lightning' : 'ph-fill ph-flame'} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.01em' }}>
        No {fuelName} data yet
      </div>
      <div style={{ fontSize: 13, color: 'var(--fg-3)', maxWidth: 420, lineHeight: 1.5 }}>
        Upload your PG&amp;E "Green Button" CSV and Hearth turns it into trends, anomaly events, a
        peak-window read of your own rate plan, and dollar-quantified advice.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => hearth.openOb(2)}
          className="h-interactive btn-acc press98"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 18px',
            borderRadius: 100,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 13,
            fontWeight: 700,
            background: 'var(--acc,#ffdd55)',
            color: '#0a0a0a',
          }}
        >
          <i className="ph ph-plus" style={{ fontSize: 14 }} />
          Upload CSV
        </button>
        <button
          onClick={() => hearth.setMode('demo')}
          className="h-interactive hov-bg3"
          style={{
            padding: '9px 18px',
            borderRadius: 100,
            border: '1px solid var(--bg-6)',
            cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 13,
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--fg-2)',
          }}
        >
          Browse the demo
        </button>
      </div>
    </div>
  )
}
