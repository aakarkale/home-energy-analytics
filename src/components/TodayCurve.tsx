// Today's outdoor temperature against the thermostat setpoint, on one shared
// temperature axis, across the same 6am-to-6am window as the schedule cards
// above it. Two series that share a unit belong on one axis: the whole point is
// reading the gap between what it is outside and what you are asking for.
//
// Bands carry the colour and name of the schedule card they belong to, so the
// two read as one thing. Their widths are real elapsed time, not card widths:
// a peak window is genuinely narrower than an evening, and stretching hours to
// match a card would lie about the curve.
//
// Text and bands are HTML positioned by percentage; only the two data paths are
// SVG, stretched with preserveAspectRatio="none" and non-scaling strokes. That
// keeps labels and the focus dot round and legible at any width.

import type { CSSProperties } from 'react'
import type { AcPlan, ScheduleBlock } from '../lib/acplan'
import type { TempUnit } from '../lib/format'
import { fmtTemp, hourShort } from '../lib/format'
import { HoverChart, type TipModel } from './chart'

/** Validated against both surfaces: CVD ΔE 28 protan, 38 normal-vision. */
const OUTDOOR = '#ff4538'
const SETPOINT = '#2995ff'

const H = 168

/** The schedule cards and the chart bands beneath them must divide the day
 *  identically or the two stop reading as one thing, so both take their columns
 *  from here. Widths are proportional to each block's real duration: a 3-hour
 *  pre-cool is narrower than a 9-hour evening, and the chart's time axis says
 *  the same. */
export const SCHEDULE_GAP = 10

/** Blocks that actually occupy time. A peak window at an unusual hour can clamp
 *  one to zero length, and an empty column would knock the two rows out of step. */
export function visibleBlocks(schedule: ScheduleBlock[]): ScheduleBlock[] {
  return schedule.filter((b) => b.toHour > b.fromHour)
}

export function scheduleColumns(schedule: ScheduleBlock[]): string {
  return visibleBlocks(schedule)
    .map((b) => `${b.toHour - b.fromHour}fr`)
    .join(' ')
}

export function TodayCurve({
  plan,
  unit,
  nowHour,
}: {
  plan: AcPlan
  unit: TempUnit
  /** Current local hour, so the reader can see where in the day they are. */
  nowHour: number
}) {
  const rows = plan.hourly
  if (!rows || rows.length < 4) return null

  const outs = rows.map((r) => r.outF)
  const sets = rows.map((r) => r.setF).filter((v): v is number => v !== null)
  const lo = Math.min(...outs, ...sets) - 3
  const hi = Math.max(...outs, ...sets) + 3
  const span = hi - lo || 1

  const x = (i: number) => (rows.length < 2 ? 0.5 : i / (rows.length - 1))
  const y = (v: number) => 100 - ((v - lo) / span) * 100

  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${(x(i) * 100).toFixed(2)},${y(r.outF).toFixed(2)}`).join(' ')
  const area = `${line} L100,100 L0,100 Z`

  // The setpoint holds flat across a block and jumps between them, so it is a
  // step, not a slope. Gaps are real: a band with the AC off has no setpoint.
  const stepRuns: string[] = []
  let run: string[] = []
  rows.forEach((r, i) => {
    if (r.setF === null) {
      if (run.length > 1) stepRuns.push(run.join(' '))
      run = []
      return
    }
    const px = (x(i) * 100).toFixed(2)
    const py = y(r.setF).toFixed(2)
    if (!run.length) run.push(`M${px},${py}`)
    else {
      const prev = rows[i - 1]!.setF
      if (prev !== null && prev !== r.setF) run.push(`L${px},${y(prev).toFixed(2)}`)
      run.push(`L${px},${py}`)
    }
  })
  if (run.length > 1) stepRuns.push(run.join(' '))

  const bands = visibleBlocks(plan.schedule)

  const nowIdx = rows.findIndex((r) => r.hour === nowHour)

  const tip = (i: number): TipModel | null => {
    const r = rows[i]
    if (!r) return null
    const b = plan.schedule[r.block]
    return {
      title: b ? `${hourShort(r.hour)} · ${b.period}` : hourShort(r.hour),
      rows: [
        { color: OUTDOOR, label: 'Outside', value: fmtTemp(r.outF, unit) },
        {
          color: SETPOINT,
          label: 'Your setpoint',
          value: r.setF === null ? 'AC off' : fmtTemp(r.setF, unit),
        },
      ],
    }
  }

  const tick: CSSProperties = {
    position: 'absolute',
    transform: 'translateX(-50%)',
    fontSize: 10,
    color: 'var(--fg-5)',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Two series, so a legend is always present. */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { c: OUTDOOR, t: 'Outside' },
          { c: SETPOINT, t: 'Your setpoint' },
        ].map((s) => (
          <span key={s.t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--fg-3)' }}>
            <span style={{ width: 14, height: 2.5, borderRadius: 2, background: s.c, flex: 'none' }} />
            {s.t}
          </span>
        ))}
      </div>

      <HoverChart
        count={rows.length}
        xAt={x}
        tip={tip}
        label="Today's outdoor temperature against your thermostat setpoint, hour by hour"
        tipTop={4}
        style={{ height: H }}
      >
        {(hover) => (
          <>
            {/* Bands first: they are the ground the curves sit on. Same grid
                template and gap as the cards above, so the columns line up. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                bottom: 18,
                display: 'grid',
                gridTemplateColumns: scheduleColumns(plan.schedule),
                gap: SCHEDULE_GAP,
              }}
            >
              {bands.map((b) => (
                <div
                  key={b.period}
                  style={{
                    minWidth: 0,
                    background: b.bg,
                    border: `1px solid ${b.border}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '5px 7px',
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: '.05em',
                      textTransform: 'uppercase',
                      color: b.labelColor,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {b.period}
                  </div>
                </div>
              ))}
            </div>

            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 18, width: '100%', height: `calc(100% - 18px)` }}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="today-out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={OUTDOOR} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={OUTDOOR} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="h-area" d={area} fill="url(#today-out)" />
              {stepRuns.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={SETPOINT}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path
                className="h-draw"
                pathLength={1}
                d={line}
                fill="none"
                stroke={OUTDOOR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Where the reader is in the day. */}
            {nowIdx >= 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 18,
                  left: `${x(nowIdx) * 100}%`,
                  width: 0,
                  borderLeft: '1px dashed var(--fg-5)',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    left: 4,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '.05em',
                    color: 'var(--fg-4)',
                  }}
                >
                  NOW
                </span>
              </div>
            )}

            {/* Crosshair and focus dots, in HTML so they stay round. */}
            {hover !== null && rows[hover] && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 18,
                    left: `${x(hover) * 100}%`,
                    width: 0,
                    borderLeft: '1px solid var(--fg-4)',
                    pointerEvents: 'none',
                  }}
                />
                {([
                  [rows[hover]!.outF, OUTDOOR],
                  [rows[hover]!.setF, SETPOINT],
                ] as const).map(([v, c]) =>
                  v === null ? null : (
                    <div
                      key={c}
                      style={{
                        position: 'absolute',
                        left: `${x(hover) * 100}%`,
                        top: `calc(${y(v)}% * ${(H - 18) / H})`,
                        width: 9,
                        height: 9,
                        marginLeft: -4.5,
                        marginTop: -4.5,
                        borderRadius: 100,
                        background: c,
                        border: '2px solid var(--bg-2)',
                        pointerEvents: 'none',
                      }}
                    />
                  ),
                )}
              </>
            )}

            {/* Recessive hour axis. */}
            {rows.map((r, i) =>
              r.hour % 6 === 0 ? (
                <span
                  key={i}
                  style={{
                    ...tick,
                    bottom: 0,
                    left: `${x(i) * 100}%`,
                    // The first and last ticks would hang off the plot.
                    transform:
                      i === 0
                        ? 'none'
                        : i === rows.length - 1
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                  }}
                >
                  {hourShort(r.hour)}
                </span>
              ) : null,
            )}
          </>
        )}
      </HoverChart>
    </div>
  )
}
