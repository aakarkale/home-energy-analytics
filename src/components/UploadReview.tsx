import type { CSSProperties, ReactNode } from 'react'
import type { ParsedUpload } from '../lib/parse'
import { daysBetween, toRuns, type DayRun, type UploadChoice, type UploadReview } from '../lib/merge'
import { fmtDateNum } from '../lib/format'

// What a signed-in upload is checked for before anything is saved: where the
// new file overlaps the saved history, what gap it would leave, and what it
// adds. Shown under the file on the upload step, and answered there once.

const OVERLAP = 'var(--accent-coral)'
const OVERLAP_BG = 'rgba(255,133,115,0.22)'
const GAP = 'var(--accent-red)'
const GAP_BG = 'repeating-linear-gradient(135deg, rgba(255,69,56,0.34) 0 3px, transparent 3px 7px)'
const NEW = 'var(--acc,#ffdd55)'
const FILL = 'var(--accent-green)'

const FUEL_NAME = { electric: 'electricity', gas: 'gas' } as const

const span = (r: { start: string; end: string }) =>
  r.start === r.end ? fmtDateNum(r.start) : `${fmtDateNum(r.start)} – ${fmtDateNum(r.end)}`
const dayCount = (n: number) => `${n} day${n === 1 ? '' : 's'}`

/** True when the file changes or skips something the user should agree to. */
export function needsConfirmation(review: UploadReview): boolean {
  return !!review.blocked || review.overlapDays > 0 || review.gapDays > 0
}

const ROW = 14
const ROW_GAP = 6

/** Saved history above, the new file below, overlap and gaps marked across both. */
function Timeline({ saved, incoming, review }: { saved: ParsedUpload; incoming: ParsedUpload; review: UploadReview }) {
  const start = saved.periodStart < incoming.periodStart ? saved.periodStart : incoming.periodStart
  const end = saved.periodEnd > incoming.periodEnd ? saved.periodEnd : incoming.periodEnd
  const days = daysBetween(start, end) + 1
  const place = (r: DayRun): CSSProperties => ({
    position: 'absolute',
    left: `${(daysBetween(start, r.start) / days) * 100}%`,
    width: `max(3px, ${(r.days / days) * 100}%)`,
  })
  const track = (runs: DayRun[], color: string, top: number) => (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: top + 3, height: 8, borderRadius: 4, background: 'var(--bg-5)' }} />
      {runs.map((r) => (
        <div key={r.start} style={{ ...place(r), top: top + 3, height: 8, borderRadius: 3, background: color }} />
      ))}
    </>
  )
  const label: CSSProperties = { height: ROW, lineHeight: `${ROW}px`, fontSize: 11, color: 'var(--fg-4)' }
  const described = [
    `Saved ${span({ start: saved.periodStart, end: saved.periodEnd })}`,
    `this file ${span({ start: incoming.periodStart, end: incoming.periodEnd })}`,
    ...review.overlap.map((r) => `overlap ${span(r)}`),
    ...review.gaps.map((r) => `gap ${span(r)}`),
  ].join(', ')
  return (
    <div
      role="img"
      aria-label={described}
      style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 10, rowGap: 5 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP }}>
        <span style={label}>Saved</span>
        <span style={label}>This file</span>
      </div>
      <div style={{ position: 'relative', height: ROW * 2 + ROW_GAP }}>
        {track(toRuns(saved.readings.map((r) => r.d)), 'var(--fg-4)', 0)}
        {track(toRuns(incoming.readings.map((r) => r.d)), NEW, ROW + ROW_GAP)}
        {review.gaps.map((r) => (
          <div
            key={`g${r.start}`}
            style={{ ...place(r), top: -3, bottom: -3, borderRadius: 3, border: `1px dashed ${GAP}`, background: GAP_BG, boxSizing: 'border-box' }}
          />
        ))}
        {review.overlap.map((r) => (
          <div
            key={`o${r.start}`}
            style={{ ...place(r), top: -3, bottom: -3, borderRadius: 3, border: `1.5px solid ${OVERLAP}`, background: OVERLAP_BG, boxSizing: 'border-box' }}
          />
        ))}
      </div>
      <span />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--fg-5)', fontVariantNumeric: 'tabular-nums' }}>
        <span>{fmtDateNum(start)}</span>
        <span>{fmtDateNum(end)}</span>
      </div>
    </div>
  )
}

function Swatch({ style }: { style: CSSProperties }) {
  return <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, flex: 'none', boxSizing: 'border-box', ...style }} />
}

/** One labelled date range per line. A range never breaks mid-way; on a narrow
 *  screen the day count drops beneath it instead. */
function RunList({ rows }: { rows: { key: string; swatch: ReactNode; label: string; run: DayRun }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
      {rows.map((r) => (
        <div key={r.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 1 }}>
          <span style={{ width: 70, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--fg-2)' }}>
            {r.swatch}
            {r.label}
          </span>
          <span style={{ color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{span(r.run)}</span>
          <span style={{ color: 'var(--fg-4)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{dayCount(r.run.days)}</span>
        </div>
      ))}
    </div>
  )
}

/** First few runs, with the rest rolled into one line so a ragged file stays short. */
function capped(runs: DayRun[], max = 3): DayRun[] {
  if (runs.length <= max) return runs
  const rest = runs.slice(max - 1)
  return [
    ...runs.slice(0, max - 1),
    { start: rest[0].start, end: rest[rest.length - 1].end, days: rest.reduce((n, r) => n + r.days, 0) },
  ]
}

function Choice({ on, onClick, children, role = 'radio' }: { on: boolean; onClick: () => void; children: ReactNode; role?: 'radio' | 'checkbox' }) {
  return (
    <button
      role={role}
      aria-checked={on}
      onClick={onClick}
      className="h-interactive chip press97"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 13px',
        borderRadius: 100,
        border: `1px solid ${on ? OVERLAP : 'var(--bg-6)'}`,
        background: on ? 'rgba(255,133,115,0.14)' : 'var(--bg-4)',
        cursor: 'pointer',
        fontFamily: 'var(--font-dm-sans)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--fg-1)',
      }}
    >
      {on && <i className="ph ph-check" aria-hidden="true" style={{ fontSize: 13, color: OVERLAP }} />}
      {children}
    </button>
  )
}

const note: CSSProperties = { fontSize: 11.5, color: 'var(--fg-4)', lineHeight: 1.5 }

export function UploadReviewCard({
  saved,
  incoming,
  review,
  choice,
  onChoice,
}: {
  saved: ParsedUpload
  incoming: ParsedUpload
  review: UploadReview
  choice: UploadChoice
  onChoice: (c: UploadChoice) => void
}) {
  const fuel = FUEL_NAME[incoming.fuel]
  const savedSpan = span({ start: saved.periodStart, end: saved.periodEnd })

  // Nothing to decide: say what it adds and move on.
  if (!needsConfirmation(review)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          <i className="ph-fill ph-check-circle" aria-hidden="true" style={{ color: FILL, fontSize: 14, flex: 'none', transform: 'translateY(2px)' }} />
          <span>
            {review.addedDays > 0 ? (
              <>
                Adds <b style={{ color: 'var(--fg-1)' }}>{span({ start: review.added[0].start, end: review.added[review.added.length - 1].end })}</b>{' '}
                ({dayCount(review.addedDays)}) to your saved {fuel} data, {savedSpan}.
              </>
            ) : (
              <>Everything in this file is already saved, so there is nothing new to add.</>
            )}
            {review.fills.length > 0 && <> It also fills {dayCount(review.fills.reduce((n, r) => n + r.days, 0))} that were missing.</>}
          </span>
        </div>
      </div>
    )
  }

  const frame: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '13px 14px',
    borderRadius: 12,
    background: 'var(--bg-3)',
    border: `1px solid ${review.blocked ? 'rgba(255,69,56,0.45)' : 'rgba(255,133,115,0.45)'}`,
  }
  const heading = (title: string, sub?: ReactNode) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <i
        className="ph-fill ph-warning-circle"
        aria-hidden="true"
        style={{ fontSize: 16, color: review.blocked ? GAP : OVERLAP, flex: 'none', marginTop: 1 }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.4 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )

  if (review.blocked) {
    const replacing = choice === 'replace-all'
    return (
      <div style={frame}>
        {review.blocked === 'granularity'
          ? heading(
              `Can't be combined with your saved ${fuel} data`,
              `Your saved data is ${saved.granularity} and this file is ${incoming.granularity}, so the two can't share one history.`,
            )
          : heading(
              'This file is for a different meter',
              `It's for the account ending ${incoming.serviceRef}, and your saved ${fuel} data is for the one ending ${saved.serviceRef}.`,
            )}
        <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 10, rowGap: 4, fontSize: 12 }}>
          <span style={{ color: 'var(--fg-4)' }}>Saved</span>
          <span style={{ color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>
            {savedSpan} · {saved.granularity}
          </span>
          <span style={{ color: 'var(--fg-4)' }}>This file</span>
          <span style={{ color: 'var(--fg-1)', fontVariantNumeric: 'tabular-nums' }}>
            {span({ start: incoming.periodStart, end: incoming.periodEnd })} · {incoming.granularity}
          </span>
        </div>
        <div>
          <Choice role="checkbox" on={replacing} onClick={() => onChoice(replacing ? 'keep' : 'replace-all')}>
            Replace my saved {fuel} data with this file
          </Choice>
        </div>
        <div style={note}>
          {replacing
            ? `Your saved ${fuel} data (${savedSpan}) will be removed and this file will take its place.`
            : 'Or remove the file above to keep what you have.'}
        </div>
      </div>
    )
  }

  const title =
    review.overlapDays && review.gapDays
      ? `Overlaps your saved ${fuel} data and leaves a gap`
      : review.overlapDays
        ? `Overlaps your saved ${fuel} data`
        : `Leaves a gap in your ${fuel} data`

  const rows = [
    ...capped(review.overlap).map((run) => ({
      key: `o${run.start}`,
      swatch: <Swatch style={{ background: OVERLAP_BG, border: `1.5px solid ${OVERLAP}` }} />,
      label: 'Overlap',
      run,
    })),
    ...capped(review.gaps).map((run) => ({
      key: `g${run.start}`,
      swatch: <Swatch style={{ background: GAP_BG, border: `1px dashed ${GAP}` }} />,
      label: 'Gap',
      run,
    })),
    ...capped(review.added).map((run) => ({
      key: `a${run.start}`,
      swatch: <Swatch style={{ background: NEW }} />,
      label: 'New',
      run,
    })),
    ...capped(review.fills).map((run) => ({
      key: `f${run.start}`,
      swatch: <Swatch style={{ background: FILL }} />,
      label: 'Fills',
      run,
    })),
  ]

  return (
    <div style={frame}>
      {heading(title)}
      <Timeline saved={saved} incoming={incoming} review={review} />
      <RunList rows={rows} />

      {review.overlapDays > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>
            For the {dayCount(review.overlapDays)} already saved
          </div>
          <div role="radiogroup" aria-label="Overlapping days" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Choice on={choice !== 'replace'} onClick={() => onChoice('keep')}>
              Keep what's saved
              <span style={{ fontWeight: 500, color: 'var(--fg-4)' }}>default</span>
            </Choice>
            <Choice on={choice === 'replace'} onClick={() => onChoice('replace')}>
              Use this file
            </Choice>
          </div>
          <div style={note}>
            {choice === 'replace'
              ? `Those days take this file's readings instead, which helps if PG&E has since replaced estimated reads.`
              : review.addedDays > 0
                ? `Those days stay as they are and this file's readings for them are ignored.`
                : `Everything in this file is already saved, so keeping what's saved adds nothing new.`}
          </div>
        </div>
      )}

      {review.gapDays > 0 && (
        <div style={note}>
          Nothing covers the gap, so charts will run straight across it. Upload a file for those dates
          any time to fill it in.
        </div>
      )}
    </div>
  )
}
