import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Archive, EventFilter, EvMetaEntry, Hearth } from '../types'
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

const btnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  flex: 'none',
  borderRadius: 100,
  padding: '9px 18px',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 13,
  fontWeight: 700,
}

/** An event carries the user's input once it has a cause or is marked away. */
const isTagged = (m: EvMetaEntry | undefined) => !!m && ((!!m.cause && m.cause !== CAUSE_OPTS[0]) || !!m.away)

/** "3 answers and 1 tagged event". */
function inputPhrase(answers: number, events: number): string {
  const parts: string[] = []
  if (answers) parts.push(`${answers} ${answers === 1 ? 'answer' : 'answers'}`)
  if (events) parts.push(`${events} tagged ${events === 1 ? 'event' : 'events'}`)
  return parts.join(' and ')
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** One diagnostic question, open for answering. */
function QuestionCard({
  hearth,
  q,
  onArchive,
}: {
  hearth: Hearth
  q: QDef
  /** Files this question away. Offered once it has an answer. */
  onArchive: () => void
}) {
  const { acc, accSoft, elec } = hearth
  const key = hearth.fuel + ':' + q.id
  const ans = hearth.answers[key] || []
  const done = ans.length > 0
  const otherVal = hearth.otherDraft[key] || ''
  const custom = ans.filter((x) => !q.opts.includes(x))

  return (
    <div
      id={`calibrate-q-${q.id}`}
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
          <button onClick={onArchive} className="h-interactive hov-fg2" style={linkBtn}>
            Archive
          </button>
        )}
      </div>
    </div>
  )
}

/** An archived answer: readable at a glance, and restorable for editing. */
function ArchivedAnswer({ hearth, q, onRestore }: { hearth: Hearth; q: QDef; onRestore: () => void }) {
  const key = hearth.fuel + ':' + q.id
  const ans = hearth.answers[key] || []
  return (
    <div style={archivedRow}>
      <i className="ph-fill ph-check-circle" style={{ color: 'var(--accent-green)', fontSize: 16, flex: 'none', marginTop: 1 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-5)' }}>
          {q.tag}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.45, marginTop: 2 }}>{q.text}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', marginTop: 5 }}>{ans.join(' · ')}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
        <button onClick={onRestore} className="h-interactive hov-fg2" style={linkBtn}>
          Restore
        </button>
        <button onClick={() => hearth.clearAnswer(key)} className="h-interactive hov-fg2" style={linkBtn}>
          Clear
        </button>
      </div>
    </div>
  )
}

/** An archived event and the tags it was filed with. */
function ArchivedEvent({
  e,
  meta,
  onRestore,
}: {
  e: { type: string; title: string; sev: keyof typeof SEV_COLOR }
  meta: EvMetaEntry
  onRestore: () => void
}) {
  const tags = [meta.cause && meta.cause !== CAUSE_OPTS[0] ? meta.cause : null, meta.away ? 'Away' : null].filter(Boolean)
  return (
    <div style={archivedRow}>
      <span
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: SEV_COLOR[e.sev], background: SEV_BG[e.sev], borderRadius: 100, padding: '3px 8px', flex: 'none' }}
      >
        {e.type}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.45 }}>{e.title}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', marginTop: 3 }}>{tags.join(' · ')}</div>
      </div>
      <button onClick={onRestore} className="h-interactive hov-fg2" style={{ ...linkBtn, flex: 'none' }}>
        Restore
      </button>
    </div>
  )
}

const archivedRow: CSSProperties = {
  display: 'flex',
  gap: 11,
  alignItems: 'flex-start',
  padding: '11px 13px',
  borderRadius: 12,
  background: 'var(--bg-3)',
  border: '1px solid var(--bg-6)',
}

const groupLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--fg-4)',
  marginTop: 4,
}

export function Calibrate({ hearth }: { hearth: Hearth }) {
  const { bundle } = hearth
  const [showArchive, setShowArchive] = useState(false)
  /** What was just archived, kept for a few seconds so it can be undone. */
  const [filed, setFiled] = useState<(Archive & { phrase: string }) | null>(null)
  /** A card to bring into view once it renders, after a restore. */
  const [reveal, setReveal] = useState<string | null>(null)
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
  useEffect(() => {
    if (!filed) return
    const t = window.setTimeout(() => setFiled(null), 6000)
    return () => window.clearTimeout(t)
  }, [filed])
  // An undo belongs to the fuel it was made on, and gives way once the user
  // moves on to answering or tagging something else.
  const tagSig = JSON.stringify(hearth.evMeta)
  useEffect(() => setFiled(null), [hearth.fuel, sig, tagSig])
  useEffect(() => {
    if (!reveal) return
    document.getElementById(reveal)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
    setReveal(null)
  }, [reveal])

  if (!bundle) return <EmptyState hearth={hearth} />
  const a = bundle.analysis
  const qDefs = bundle.questions

  const archivedAnswers = new Set(hearth.archive.answers)
  const archivedEvents = new Set(hearth.archive.events)
  const qKey = (q: QDef) => `${hearth.fuel}:${q.id}`
  const evKey = (date: string) => `${hearth.fuel}:${date}`
  const metaOf = (date: string) => hearth.evMeta[evKey(date)]

  const isAnswered = (q: QDef) => !!hearth.answers[qKey(q)]?.length
  const qArchived = (q: QDef) => isAnswered(q) && archivedAnswers.has(qKey(q))
  const openQs = qDefs.filter((q) => !qArchived(q))
  const archivedQs = qDefs.filter(qArchived)
  const answered = qDefs.filter(isAnswered).length
  const qProg = `${answered} of ${qDefs.length}`
  const qProgW = qDefs.length ? Math.round((answered / qDefs.length) * 100) + '%' : '0%'

  const evArchived = (date: string) => isTagged(metaOf(date)) && archivedEvents.has(evKey(date))
  const activeEvents = a.events.filter((e) => !evArchived(e.date))
  const archivedEvs = a.events.filter((e) => evArchived(e.date))

  // Only what carries the user's input is filed: an unanswered question or an
  // untagged event stays on the page, still waiting for them.
  const readyQs = openQs.filter(isAnswered)
  const readyEvs = activeEvents.filter((e) => isTagged(metaOf(e.date)))
  const ready = readyQs.length + readyEvs.length

  const file = (qs: QDef[], evs: { date: string }[]) => {
    const change: Archive = {
      answers: [...new Set(qs.map(qKey))],
      events: [...new Set(evs.map((e) => evKey(e.date)))],
    }
    hearth.setArchived(change, true)
    setFiled({ ...change, phrase: inputPhrase(qs.length, evs.length) })
  }
  const undo = () => {
    if (!filed) return
    hearth.setArchived({ answers: filed.answers, events: filed.events }, false)
    setFiled(null)
  }

  const lift = bundle.answerLift
  const moved = Math.abs(lift) >= 1

  const counts: Record<EventFilter, number> = {
    All: activeEvents.length,
    Spikes: activeEvents.filter((e) => e.type === 'Spike').length,
    'Quiet days': activeEvents.filter((e) => e.type === 'Quiet day').length,
    High: activeEvents.filter((e) => e.sev === 'high').length,
  }
  const events = activeEvents.filter((e) => {
    if (hearth.filter === 'Spikes') return e.type === 'Spike'
    if (hearth.filter === 'Quiet days') return e.type === 'Quiet day'
    if (hearth.filter === 'High') return e.sev === 'high'
    return true
  })

  const archivedCount = archivedQs.length + archivedEvs.length
  const showBar = ready > 0 || !!filed

  return (
    <>
      {openQs.length > 0 && (
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
            {openQs.map((q) => (
              <QuestionCard key={q.id} hearth={hearth} q={q} onArchive={() => file([q], [])} />
            ))}
          </div>

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
                  ? 'Answers are stored the moment you tap them.'
                  : moved
                    ? `Recomputed from your answers: ${bundle.savings.total}/yr, ${lift > 0 ? 'up' : 'down'} ${fmtMoney0(Math.abs(lift))} from the generic estimate.`
                    : `Folded into every estimate. The savings total holds at ${bundle.savings.total}/yr.`}
              </div>
            </div>
            {answered > 0 && (
              <button
                onClick={() => hearth.go('overview')}
                className="h-interactive hov-bg3 press98"
                style={{ ...btnBase, marginLeft: 'auto', border: '1px solid var(--bg-6)', background: 'transparent', padding: '8px 16px', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2)' }}
              >
                See the impact
                <i className="ph ph-arrow-right" style={{ fontSize: 14 }} />
              </button>
            )}
          </div>
        </div>
      )}

      {activeEvents.length > 0 && (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map((e, ei) => {
              const meta = metaOf(e.date) || {}
              const spine = SEV_COLOR[e.sev]
              return (
                <div
                  key={e.id}
                  id={`calibrate-ev-${e.id}`}
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
                        value={meta.cause || CAUSE_OPTS[0]}
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
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
                        {isTagged(meta) && (
                          <button
                            onClick={() => file([], activeEvents.filter((x) => x.date === e.date))}
                            className="h-interactive hov-fg2"
                            style={{ ...linkBtn, fontSize: 12 }}
                          >
                            Archive
                          </button>
                        )}
                        <button
                          onClick={() => hearth.go('energy')}
                          className="h-interactive hov-bright"
                          style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 600, color: 'var(--acc,#ffdd55)', padding: 0 }}
                        >
                          Spotlight on charts →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {openQs.length === 0 && activeEvents.length === 0 && (
        <div className="h-fade-up" style={{ ...card, padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <div
            style={{ width: 44, height: 44, borderRadius: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: archivedCount ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'var(--bg-4)' }}
          >
            <i
              className={archivedCount ? 'ph-fill ph-check-circle' : 'ph ph-target'}
              style={{ fontSize: 24, color: archivedCount ? 'var(--accent-green)' : 'var(--fg-3)' }}
            />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
            {archivedCount ? "You're all caught up" : 'Nothing to calibrate yet'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.5, maxWidth: 440 }}>
            {archivedCount
              ? 'Everything you answered is in the archive below and still refines every estimate. New questions and events show up here as new data arrives.'
              : 'Upload more data and new questions appear as patterns emerge, along with any spikes or quiet days worth explaining.'}
          </div>
          {archivedCount > 0 && (
            <button
              onClick={() => hearth.go('overview')}
              className="h-interactive hov-bg3 press98"
              style={{ ...btnBase, marginTop: 4, border: '1px solid var(--bg-6)', background: 'transparent', padding: '8px 16px', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2)' }}
            >
              See the impact
              <i className="ph ph-arrow-right" style={{ fontSize: 14 }} />
            </button>
          )}
        </div>
      )}

      {archivedCount > 0 && (
        <div style={{ ...card, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setShowArchive((v) => !v)}
            aria-expanded={showArchive}
            className="h-interactive hov-fg1"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '2px 0',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--fg-2)',
            }}
          >
            <i className="ph ph-caret-right" style={{ fontSize: 14, transition: 'transform 150ms ease', transform: showArchive ? 'rotate(90deg)' : 'none' }} />
            <i className="ph ph-archive-box" style={{ fontSize: 16 }} />
            Archive ({archivedCount})
            <span style={{ color: 'var(--fg-5)', fontWeight: 500, fontSize: 12 }}>{showArchive ? 'hide' : 'filed away, still counted'}</span>
          </button>
          {showArchive && (
            <div className="h-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 6 }}>
              {archivedQs.length > 0 && <div style={groupLabel}>Answers</div>}
              {archivedQs.map((q) => (
                <ArchivedAnswer
                  key={q.id}
                  hearth={hearth}
                  q={q}
                  onRestore={() => {
                    hearth.setArchived({ answers: [qKey(q)] }, false)
                    setReveal(`calibrate-q-${q.id}`)
                  }}
                />
              ))}
              {archivedEvs.length > 0 && <div style={groupLabel}>Events</div>}
              {archivedEvs.map((e) => (
                <ArchivedEvent
                  key={e.id}
                  e={e}
                  meta={metaOf(e.date) || {}}
                  onRestore={() => {
                    hearth.setArchived({ events: [evKey(e.date)] }, false)
                    // A filter could hide it from the feed it returns to.
                    if (hearth.filter !== 'All') hearth.setFilter('All')
                    setReveal(`calibrate-ev-${e.id}`)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showBar && (
        <div
          role="region"
          aria-label="Save and archive"
          className="h-fade-up"
          style={{
            position: 'sticky',
            // Clear of the phone tab bar, which floats over the page.
            bottom: hearth.isMobile ? 86 : 16,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: hearth.isMobile ? 10 : 12,
            padding: hearth.isMobile ? '10px 10px 10px 14px' : '12px 12px 12px 16px',
            borderRadius: 16,
            background: 'var(--bg-2)',
            border: '1px solid var(--bg-6)',
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <i
            key={filed ? 'filed' : 'ready'}
            className={filed ? 'ph-fill ph-archive-box h-pop' : 'ph ph-tray-arrow-down'}
            aria-hidden="true"
            style={{ fontSize: 20, flex: 'none', color: filed ? 'var(--accent-green)' : 'var(--fg-2)' }}
          />
          <div aria-live="polite" style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', lineHeight: 1.35 }}>
              {filed ? `Archived ${filed.phrase}` : `${inputPhrase(readyQs.length, readyEvs.length)} ready to archive`}
            </div>
            {/* On a phone the bar stays one compact row; the archive explains itself. */}
            {!hearth.isMobile && (
              <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 2, lineHeight: 1.4 }}>
                {filed
                  ? 'Still counted in every estimate. Find them in the archive below.'
                  : 'Already counted in your estimates. Archiving files them below and clears the page.'}
              </div>
            )}
          </div>
          {filed ? (
            <button
              onClick={undo}
              className="h-interactive hov-bg3 press98"
              style={{ ...btnBase, ...(hearth.isMobile && { padding: '9px 14px' }), border: '1px solid var(--bg-6)', background: 'transparent', color: 'var(--fg-1)' }}
            >
              <i className="ph ph-arrow-counter-clockwise" style={{ fontSize: 15 }} />
              Undo
            </button>
          ) : (
            <button
              onClick={() => file(readyQs, readyEvs)}
              className="h-interactive btn-acc press98"
              style={{ ...btnBase, ...(hearth.isMobile && { padding: '9px 14px' }), border: 'none', background: 'var(--acc,#ffdd55)', color: '#0a0a0a' }}
            >
              <i className="ph ph-archive-box" style={{ fontSize: 15 }} />
              Save &amp; archive
            </button>
          )}
        </div>
      )}
    </>
  )
}
