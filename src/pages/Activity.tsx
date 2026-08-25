import type { CSSProperties } from 'react'
import type { EventFilter, Hearth } from '../types'
import { CAUSE_OPTS, SEV_BG, SEV_COLOR } from '../model'
import { EmptyState } from '../components/EmptyState'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
}

const chipBase: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 100,
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 12,
  fontWeight: 600,
}

export function Activity({ hearth }: { hearth: Hearth }) {
  const { elec, acc, accSoft, bundle } = hearth
  if (!bundle) return <EmptyState hearth={hearth} />
  const a = bundle.analysis
  const qDefs = bundle.questions

  const answered = qDefs.filter((q) => hearth.answers[`${hearth.fuel}:${q.id}`]?.length).length
  const qProg = `${answered} of ${qDefs.length}`
  const qProgW = qDefs.length ? Math.round((answered / qDefs.length) * 100) + '%' : '0%'

  const counts: Record<EventFilter, number> = {
    All: a.events.length,
    Spikes: a.events.filter((e) => e.type === 'Spike').length,
    'Quiet days': a.events.filter((e) => e.type === 'Quiet day').length,
    High: a.events.filter((e) => e.sev === 'high').length,
  }
  const events = a.events.filter((e) => {
    if (hearth.filter === 'Spikes') return e.type === 'Spike'
    if (hearth.filter === 'Quiet days') return e.type === 'Quiet day'
    if (hearth.filter === 'High') return e.sev === 'high'
    return true
  })

  return (
    <>
      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Sharpen your tips</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 110, height: 5, borderRadius: 100, background: 'var(--bg-4)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--acc,#ffdd55)', borderRadius: 100, width: qProgW }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{qProg} answered</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: -8 }}>
          The meter can't tell us everything, so you supply the causes. Every answer updates your estimates instantly.
        </div>
        {qDefs.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
            Nothing to ask right now. Upload more data and new questions appear as patterns emerge.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
          {qDefs.map((q) => {
            const key = hearth.fuel + ':' + q.id
            const ans = hearth.answers[key] || []
            const done = ans.length > 0
            const otherVal = hearth.otherDraft[key] || ''
            const custom = ans.filter((x) => !q.opts.includes(x))
            return (
              <div
                key={q.id}
                style={{
                  borderRadius: 14,
                  padding: 16,
                  background: done ? accSoft : 'var(--bg-3)',
                  border: `1px solid ${done ? (elec ? 'rgba(255,221,85,0.35)' : 'rgba(41,149,255,0.4)') : 'var(--bg-6)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)', background: 'var(--bg-4)', borderRadius: 100, padding: '3px 8px', flex: 'none' }}>
                    {q.tag}
                  </span>
                  {q.money && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(4,196,10,0.12)', borderRadius: 100, padding: '3px 8px', flex: 'none' }}>
                      {q.money}
                    </span>
                  )}
                  {done && (
                    <i className="ph-fill ph-check-circle" style={{ marginLeft: 'auto', color: 'var(--acc,#ffdd55)', fontSize: 16 }} />
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.45 }}>{q.text}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {q.opts.map((o) => {
                    const on = ans.includes(o)
                    return (
                      <button
                        key={o}
                        onClick={() => hearth.toggleAnswer(key, o, !!q.multi)}
                        className="h-interactive chip press97"
                        style={{
                          ...chipBase,
                          border: `1px solid ${on ? acc : 'var(--bg-6)'}`,
                          background: on ? acc : 'var(--bg-4)',
                          color: on ? '#0a0a0a' : 'var(--fg-2)',
                        }}
                      >
                        {o}
                      </button>
                    )
                  })}
                  {custom.map((o) => (
                    <button
                      key={o}
                      onClick={() => hearth.removeCustomAnswer(key, o)}
                      className="h-interactive chip press97"
                      style={{ ...chipBase, border: `1px solid ${acc}`, background: acc, color: '#0a0a0a' }}
                    >
                      {o}
                    </button>
                  ))}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input
                      value={otherVal}
                      onChange={(e) => hearth.setOtherDraft(key, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') hearth.addOther(key, !!q.multi)
                      }}
                      maxLength={15}
                      placeholder="Something else?"
                      className="other-input"
                      style={{
                        width: 118,
                        padding: '6px 12px',
                        borderRadius: 100,
                        border: '1px dashed var(--bg-6)',
                        background: 'transparent',
                        fontFamily: 'var(--font-dm-sans)',
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--fg-1)',
                        outline: 'none',
                      }}
                    />
                    {otherVal && (
                      <button
                        onClick={() => hearth.addOther(key, !!q.multi)}
                        className="h-interactive press97"
                        style={{ ...chipBase, border: `1px solid var(--acc,#ffdd55)`, background: 'transparent', color: 'var(--acc,#ffdd55)' }}
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
                {done && (
                  <button
                    onClick={() => hearth.clearAnswer(key)}
                    className="h-interactive hov-fg2"
                    style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 11, color: 'var(--fg-4)', padding: 0, textDecoration: 'underline' }}
                  >
                    Clear answer
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Event feed</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {(Object.keys(counts) as EventFilter[]).map((f) => {
              const active = hearth.filter === f
              return (
                <button
                  key={f}
                  onClick={() => hearth.setFilter(f)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 100,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${active ? 'var(--fg-6)' : 'var(--bg-6)'}`,
                    background: active ? 'var(--bg-5)' : 'transparent',
                    color: active ? 'var(--fg-0)' : 'var(--fg-4)',
                  }}
                >
                  {f + ' ' + counts[f]}
                </button>
              )
            })}
          </div>
        </div>
        {a.events.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
            Nothing flagged: no spikes, quiet days or estimated readings in this period.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map((e) => {
            const meta = hearth.evMeta[`${hearth.fuel}:${e.date}`] || {}
            const spine = SEV_COLOR[e.sev]
            return (
              <div key={e.id} style={{ display: 'flex', borderRadius: 14, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', overflow: 'hidden' }}>
                <div style={{ width: 4, flex: 'none', background: spine }} />
                <div style={{ flex: 1, minWidth: 0, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: spine, background: SEV_BG[e.sev], borderRadius: 100, padding: '3px 8px' }}>
                      {e.type}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{e.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', background: 'var(--bg-4)', borderRadius: 100, padding: '3px 9px', flex: 'none' }}>
                      {e.cost}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>{e.detail}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.45 }}>
                    <i className="ph ph-lightbulb" style={{ color: 'var(--acc,#ffdd55)', fontSize: 14, flex: 'none', marginTop: 1 }} />
                    {e.tip}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
                    <select
                      value={meta.cause || 'What caused this?'}
                      onChange={(ev) => hearth.setCause(hearth.fuel, e.date, ev.target.value)}
                      style={{
                        background: 'var(--bg-4)',
                        color: 'var(--fg-2)',
                        border: '1px solid var(--bg-6)',
                        borderRadius: 100,
                        padding: '5px 10px',
                        fontFamily: 'var(--font-dm-sans)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {CAUSE_OPTS.map((co) => (
                        <option key={co} value={co}>
                          {co}
                        </option>
                      ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-3)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!meta.away}
                        onChange={() => hearth.toggleAway(hearth.fuel, e.date)}
                        style={{ accentColor: 'rgb(255,221,85)', width: 14, height: 14, cursor: 'pointer' }}
                      />
                      I was away
                    </label>
                    <button
                      onClick={() => hearth.go('energy')}
                      className="h-interactive hov-bright"
                      style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 600, color: 'var(--acc,#ffdd55)', padding: 0 }}
                    >
                      Spotlight on charts →
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
