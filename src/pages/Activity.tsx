import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { EventFilter, Hearth } from '../types'
import type { QDef } from '../lib/content'
import { CAUSE_OPTS, SEV_BG, SEV_COLOR } from '../model'
import { EmptyState } from '../components/EmptyState'
import { fmtMoney0 } from '../lib/format'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
}

const linkBtn: CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 11,
  color: 'var(--fg-4)',
  padding: 0,
  textDecoration: 'underline',
}

const chipBase: CSSProperties = {
  padding: '6px 12px',
  borderRadius: 100,
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 12,
  fontWeight: 600,
}

/** One diagnostic question, open for answering. Shared by the live grid and by
 *  an archived question the user reopened to edit. */
function QuestionCard({
  hearth,
  q,
  onFold,
}: {
  hearth: Hearth
  q: QDef
  /** Fold this question into the answered section. Offered once it has an answer. */
  onFold: () => void
}) {
  const { acc, accSoft, elec } = hearth
  const key = hearth.fuel + ':' + q.id
  const ans = hearth.answers[key] || []
  const done = ans.length > 0
  const otherVal = hearth.otherDraft[key] || ''
  const custom = ans.filter((x) => !q.opts.includes(x))

  return (
    <div
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
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {done && (
          <button
            onClick={() => hearth.clearAnswer(key)}
            className="h-interactive hov-fg2"
            style={linkBtn}
          >
            Clear answer
          </button>
        )}
        {done && (
          <button onClick={onFold} className="h-interactive hov-fg2" style={linkBtn}>
            Done, fold this away
          </button>
        )}
      </div>
    </div>
  )
}

/** An answered question, folded away. Readable at a glance, reopenable. */
function AnsweredRow({
  hearth,
  q,
  onEdit,
}: {
  hearth: Hearth
  q: QDef
  onEdit: () => void
}) {
  const key = hearth.fuel + ':' + q.id
  const ans = hearth.answers[key] || []
  return (
    <div
      style={{
        display: 'flex',
        gap: 11,
        alignItems: 'flex-start',
        padding: '11px 13px',
        borderRadius: 12,
        background: 'var(--bg-3)',
        border: '1px solid var(--bg-6)',
      }}
    >
      <i
        className="ph-fill ph-check-circle"
        style={{ color: 'var(--accent-green)', fontSize: 16, flex: 'none', marginTop: 1 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-5)' }}>
          {q.tag}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.45, marginTop: 2 }}>
          {q.text}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', marginTop: 5 }}>
          {ans.join(' · ')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
        <button onClick={onEdit} className="h-interactive hov-fg2" style={linkBtn}>
          Edit
        </button>
        <button
          onClick={() => hearth.clearAnswer(key)}
          className="h-interactive hov-fg2"
          style={linkBtn}
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export function Activity({ hearth }: { hearth: Hearth }) {
  const { bundle } = hearth
  const [showDone, setShowDone] = useState(false)
  // Which answers the user is finished with. Seeded from what was already
  // answered on arrival, so a returning visitor sees a clean slate; a question
  // answered in this sitting stays put until they fold it away, which matters
  // for the multi-select ones where the first tap is rarely the last.
  const [settled, setSettled] = useState<string[]>(() => Object.keys(hearth.answers))
  // Answers persist the instant they are tapped, so this reports the write
  // rather than causing it: the user sees, in words and in dollars, that the
  // information landed.
  const [saved, setSaved] = useState<string | null>(null)
  const sig = JSON.stringify(hearth.answers)
  const firstPass = useRef(true)
  useEffect(() => {
    if (firstPass.current) {
      firstPass.current = false
      return
    }
    setSaved(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
  }, [sig])

  if (!bundle) return <EmptyState hearth={hearth} />
  const a = bundle.analysis
  const qDefs = bundle.questions

  const keyOf = (q: QDef) => `${hearth.fuel}:${q.id}`
  const isAnswered = (q: QDef) => !!hearth.answers[keyOf(q)]?.length
  const isFolded = (q: QDef) => isAnswered(q) && settled.includes(keyOf(q))
  const open = qDefs.filter((q) => !isFolded(q))
  const archived = qDefs.filter(isFolded)
  const answered = qDefs.filter(isAnswered).length
  const fold = (q: QDef) => setSettled((v) => [...v, keyOf(q)])
  const unfold = (q: QDef) => setSettled((v) => v.filter((x) => x !== keyOf(q)))
  const qProg = `${answered} of ${qDefs.length}`
  const qProgW = qDefs.length ? Math.round((answered / qDefs.length) * 100) + '%' : '0%'

  const lift = bundle.answerLift
  const moved = Math.abs(lift) >= 1

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
              <div className="h-wipe" style={{ height: '100%', background: 'var(--acc,#ffdd55)', borderRadius: 100, width: qProgW }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{qProg} answered</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: -8 }}>
          The meter can't tell us everything, so you supply the causes. Every answer saves as you tap
          it and every estimate is recomputed from it.
        </div>

        {qDefs.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
            Nothing to ask right now. Upload more data and new questions appear as patterns emerge.
          </div>
        )}

        {open.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
            {open.map((q) => (
              <QuestionCard key={q.id} hearth={hearth} q={q} onFold={() => fold(q)} />
            ))}
          </div>
        )}

        {qDefs.length > 0 && open.length === 0 && (
          <div
            className="h-fade-up"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '13px 15px',
              borderRadius: 12,
              background: 'rgba(4,196,10,0.10)',
              border: '1px solid rgba(4,196,10,0.28)',
            }}
          >
            <i className="ph-fill ph-check-circle" style={{ color: 'var(--accent-green)', fontSize: 18, flex: 'none' }} />
            <div style={{ fontSize: 13, color: 'var(--fg-1)', lineHeight: 1.45 }}>
              Every question answered. Your estimates are as sharp as this billing period allows.
            </div>
          </div>
        )}

        {archived.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="h-interactive hov-fg1"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                alignSelf: 'flex-start',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
                fontFamily: 'var(--font-dm-sans)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--fg-3)',
              }}
            >
              <i
                className="ph ph-caret-right"
                style={{
                  fontSize: 14,
                  transition: 'transform 150ms ease',
                  transform: showDone ? 'rotate(90deg)' : 'none',
                }}
              />
              Answered ({archived.length})
              <span style={{ color: 'var(--fg-5)', fontWeight: 500 }}>
                {showDone ? 'hide' : 'folded away, still counted'}
              </span>
            </button>
            {showDone && (
              <div className="h-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {archived.map((q) => (
                  <AnsweredRow
                    key={q.id}
                    hearth={hearth}
                    q={q}
                    onEdit={() => {
                      unfold(q)
                      setShowDone(false)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {qDefs.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              borderTop: '1px solid var(--bg-6)',
              paddingTop: 13,
            }}
          >
            <i
              key={saved ?? 'idle'}
              className={answered ? 'ph-fill ph-check-circle h-pop' : 'ph ph-info'}
              style={{ fontSize: 19, flex: 'none', color: answered ? 'var(--accent-green)' : 'var(--fg-4)' }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>
                {answered === 0
                  ? 'Nothing answered yet'
                  : saved
                    ? `Saved ${saved}`
                    : `${answered} ${answered === 1 ? 'answer' : 'answers'} saved`}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 2, lineHeight: 1.45 }}>
                {answered === 0
                  ? 'Answers are stored the moment you tap them. Nothing to submit.'
                  : moved
                    ? `Recomputed from your answers: ${bundle.savings.total}/yr, ${lift > 0 ? 'up' : 'down'} ${fmtMoney0(Math.abs(lift))} from the generic estimate.`
                    : `Folded into every estimate. The savings total holds at ${bundle.savings.total}/yr.`}
              </div>
            </div>
            {answered > 0 && (
              <button
                onClick={() => hearth.go('overview')}
                className="h-interactive hov-bg3 press98"
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  border: '1px solid var(--bg-6)',
                  background: 'transparent',
                  borderRadius: 100,
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--fg-2)',
                }}
              >
                See the impact
                <i className="ph ph-arrow-right" style={{ fontSize: 14 }} />
              </button>
            )}
          </div>
        )}
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
          {events.map((e, ei) => {
            const meta = hearth.evMeta[`${hearth.fuel}:${e.date}`] || {}
            const spine = SEV_COLOR[e.sev]
            return (
              <div
                key={e.id}
                className="h-fade-up h-lift"
                style={{ display: 'flex', borderRadius: 14, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', overflow: 'hidden', animationDelay: `${Math.min(ei, 8) * 55}ms` }}
              >
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
