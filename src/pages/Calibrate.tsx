import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Archive, Hearth } from '../types'
import { answerOf, dayTag, type QDef } from '../lib/content'
import { SEV_BG, SEV_COLOR } from '../model'
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

const tagChip: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  borderRadius: 100,
  padding: '3px 8px',
  flex: 'none',
}

/** A flagged day's tag wears its severity colour; other questions stay neutral. */
const tagColours = (q: QDef): CSSProperties =>
  q.day ? { color: SEV_COLOR[q.day.sev], background: SEV_BG[q.day.sev] } : { color: 'var(--fg-4)', background: 'var(--bg-4)' }

const answersPhrase = (n: number) => `${n} ${n === 1 ? 'answer' : 'answers'}`

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Reads and writes one question's answer wherever it lives: `answers` for most
 * questions, the day's event tag for a question about a flagged day. A flagged
 * day takes one answer, so a new pick or a typed one replaces the last.
 */
function answerIO(hearth: Hearth, q: QDef) {
  const { fuel } = hearth
  const ans = answerOf(q, fuel, hearth.answers, hearth.evMeta)
  const draftKey = `${fuel}:${q.id}`
  if (!q.day) {
    return {
      ans,
      draftKey,
      toggle: (o: string) => hearth.toggleAnswer(draftKey, o, !!q.multi),
      removeCustom: (o: string) => hearth.removeCustomAnswer(draftKey, o),
      addOther: () => hearth.addOther(draftKey, !!q.multi),
      clear: () => hearth.clearAnswer(draftKey),
    }
  }
  const { date } = q.day
  const set = (value: string | null) =>
    hearth.setDayTag(fuel, date, dayTag(q, value, hearth.evMeta[`${fuel}:${date}`]))
  return {
    ans,
    draftKey,
    toggle: (o: string) => set(ans.includes(o) ? null : o),
    removeCustom: () => set(null),
    addOther: () => {
      const v = (hearth.otherDraft[draftKey] || '').trim().slice(0, 15)
      if (!v) return
      set(v)
      hearth.setOtherDraft(draftKey, '')
    },
    clear: () => set(null),
  }
}

/** One question, open for answering: a diagnostic one, or one about a flagged day. */
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
  const io = answerIO(hearth, q)
  const ans = io.ans
  const done = ans.length > 0
  const otherVal = hearth.otherDraft[io.draftKey] || ''
  const custom = ans.filter((x) => !q.opts.includes(x))
  const cost = q.day && q.day.cost !== '—' ? q.day.cost : null

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
        <span style={{ ...tagChip, ...tagColours(q) }}>{q.tag}</span>
        {q.money && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(4,196,10,0.12)', borderRadius: 100, padding: '3px 8px', flex: 'none' }}>
            {q.money}
          </span>
        )}
        {cost && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-2)', background: 'var(--bg-4)', borderRadius: 100, padding: '3px 8px', flex: 'none' }}>
            {cost}
          </span>
        )}
        {done && (
          <i className="ph-fill ph-check-circle" style={{ marginLeft: 'auto', color: 'var(--acc,#ffdd55)', fontSize: 16 }} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.45 }}>{q.text}</div>
        {q.day && <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>{q.day.detail}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {q.opts.map((o) => {
          const on = ans.includes(o)
          return (
            <button
              key={o}
              onClick={() => io.toggle(o)}
              aria-pressed={on}
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
            onClick={() => io.removeCustom(o)}
            aria-pressed="true"
            className="h-interactive chip press97"
            style={{ ...chipBase, border: `1px solid ${acc}`, background: acc, color: '#0a0a0a' }}
          >
            {o}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            value={otherVal}
            onChange={(e) => hearth.setOtherDraft(io.draftKey, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') io.addOther()
            }}
            maxLength={15}
            placeholder="Something else?"
            aria-label={`Something else: ${q.text}`}
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
              onClick={io.addOther}
              className="h-interactive press97"
              style={{ ...chipBase, border: `1px solid var(--acc,#ffdd55)`, background: 'transparent', color: 'var(--acc,#ffdd55)' }}
            >
              Add
            </button>
          )}
        </div>
      </div>
      {q.day && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.45 }}>
          <i className="ph ph-lightbulb" style={{ color: 'var(--acc,#ffdd55)', fontSize: 14, flex: 'none', marginTop: 1 }} />
          {q.day.tip}
        </div>
      )}
      {(done || q.day) && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {done && (
            <button onClick={io.clear} className="h-interactive hov-fg2" style={linkBtn}>
              Clear answer
            </button>
          )}
          {done && (
            <button onClick={onArchive} className="h-interactive hov-fg2" style={linkBtn}>
              Archive
            </button>
          )}
          {q.day && (
            <button
              onClick={() => hearth.go('energy')}
              className="h-interactive hov-bright"
              style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 600, color: 'var(--acc,#ffdd55)', padding: 0 }}
            >
              Spotlight on charts →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** An archived answer: readable at a glance, and restorable for editing. */
function ArchivedAnswer({ hearth, q, onRestore }: { hearth: Hearth; q: QDef; onRestore: () => void }) {
  const io = answerIO(hearth, q)
  return (
    <div style={archivedRow}>
      <i className="ph-fill ph-check-circle" style={{ color: 'var(--accent-green)', fontSize: 16, flex: 'none', marginTop: 1 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ ...tagChip, ...tagColours(q), display: 'inline-block' }}>{q.tag}</span>
        <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.45, marginTop: 5 }}>{q.text}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-0)', marginTop: 5 }}>{io.ans.join(' · ')}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
        <button onClick={onRestore} className="h-interactive hov-fg2" style={linkBtn}>
          Restore
        </button>
        <button onClick={io.clear} className="h-interactive hov-fg2" style={linkBtn}>
          Clear
        </button>
      </div>
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

export function Calibrate({ hearth }: { hearth: Hearth }) {
  const { bundle } = hearth
  const [showArchive, setShowArchive] = useState(false)
  /** What was just archived, kept for a few seconds so it can be undone. */
  const [filed, setFiled] = useState<(Archive & { phrase: string }) | null>(null)
  /** A card to bring into view once it renders, after a restore. */
  const [reveal, setReveal] = useState<string | null>(null)
  // Answers persist the instant they are tapped, so this reports the write
  // rather than causing it: the user sees, in words and in dollars, that the
  // information landed. A flagged day's answer is its event tag, so both count.
  const [saved, setSaved] = useState<string | null>(null)
  const sig = JSON.stringify(hearth.answers) + JSON.stringify(hearth.evMeta)
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
  // moves on to answering something else.
  useEffect(() => setFiled(null), [hearth.fuel, sig])
  useEffect(() => {
    if (!reveal) return
    document.getElementById(reveal)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' })
    setReveal(null)
  }, [reveal])

  if (!bundle) return <EmptyState hearth={hearth} />
  const qDefs = bundle.questions

  // Where each question is filed: a flagged day with the day's tags, the rest
  // with the answers.
  const kindOf = (q: QDef): keyof Archive => (q.day ? 'events' : 'answers')
  const keyOf = (q: QDef) => `${hearth.fuel}:${q.day ? q.day.date : q.id}`
  const filedKeys = { answers: new Set(hearth.archive.answers), events: new Set(hearth.archive.events) }

  const isAnswered = (q: QDef) => answerOf(q, hearth.fuel, hearth.answers, hearth.evMeta).length > 0
  const isArchived = (q: QDef) => isAnswered(q) && filedKeys[kindOf(q)].has(keyOf(q))
  const openQs = qDefs.filter((q) => !isArchived(q))
  const archivedQs = qDefs.filter(isArchived)
  const answered = qDefs.filter(isAnswered).length
  const qProg = `${answered} of ${qDefs.length}`
  const qProgW = qDefs.length ? Math.round((answered / qDefs.length) * 100) + '%' : '0%'

  // Only answered questions are filed: an unanswered one stays on the page,
  // still waiting for them.
  const readyQs = openQs.filter(isAnswered)

  const file = (qs: QDef[]) => {
    const change: Archive = { answers: [], events: [] }
    for (const q of qs) change[kindOf(q)].push(keyOf(q))
    hearth.setArchived(change, true)
    setFiled({ ...change, phrase: answersPhrase(qs.length) })
  }
  const undo = () => {
    if (!filed) return
    hearth.setArchived({ answers: filed.answers, events: filed.events }, false)
    setFiled(null)
  }

  const lift = bundle.answerLift
  const moved = Math.abs(lift) >= 1

  const archivedCount = archivedQs.length
  const showBar = readyQs.length > 0 || !!filed

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
              <QuestionCard key={q.id} hearth={hearth} q={q} onArchive={() => file([q])} />
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
                {answered === 0 ? 'Nothing answered yet' : saved ? `Saved ${saved}` : `${answersPhrase(answered)} saved`}
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

      {openQs.length === 0 && (
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
              ? 'Everything you answered is in the archive below and still refines every estimate. New questions show up here as new data arrives.'
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
              {archivedQs.map((q) => (
                <ArchivedAnswer
                  key={q.id}
                  hearth={hearth}
                  q={q}
                  onRestore={() => {
                    hearth.setArchived({ [kindOf(q)]: [keyOf(q)] }, false)
                    setReveal(`calibrate-q-${q.id}`)
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
              {filed ? `Archived ${filed.phrase}` : `${answersPhrase(readyQs.length)} ready to archive`}
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
              onClick={() => file(readyQs)}
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
