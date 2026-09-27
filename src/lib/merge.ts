// Combining a new upload with the history an account already holds.
//
// A signed-in account keeps one history per fuel. A new file is merged into it
// rather than replacing it, and before anything is saved the upload step shows
// where the file overlaps that history and what gaps it would leave, so no day
// is silently dropped, doubled or skipped.
//
// Readings are matched by key: the day, plus the hour for hourly data. Where
// both hold a reading for the same key the saved one is kept by default. The
// user can take the new file's instead, which is right when PG&E has since
// reissued estimated reads as actuals and the later export is the better copy.

import { parseGreenButtonCsv, toGreenButtonCsv, type ParsedUpload, type Reading } from './parse'
import { addDays } from './format'

/** A run of consecutive calendar days, inclusive at both ends. */
export interface DayRun {
  start: string
  end: string
  days: number
}

/** What to do with readings both the saved history and the new file hold. */
export type OverlapChoice = 'keep' | 'replace'

/** The user's decision for one file: merge (keeping or replacing overlapping
 *  readings), or replace the saved history outright. */
export type UploadChoice = OverlapChoice | 'replace-all'

export interface UploadReview {
  /** Why the file cannot join the saved history at all, or null if it can. */
  blocked: null | 'granularity' | 'meter'
  /** Days this file has readings for that are already saved. */
  overlap: DayRun[]
  overlapDays: number
  /** Days with no data that accepting this file would leave between it and the
   *  saved history. Holes the history already had are not this file's doing
   *  and are not repeated here. */
  gaps: DayRun[]
  gapDays: number
  /** Holes in the saved history that this file fills. */
  fills: DayRun[]
  /** Days that gain readings when the saved readings are kept. */
  added: DayRun[]
  addedDays: number
}

const keyOf = (r: Reading) => (r.h === undefined ? r.d : `${r.d}#${r.h}`)

const byTime = (a: Reading, b: Reading) =>
  a.d === b.d ? (a.h ?? 0) - (b.h ?? 0) : a.d < b.d ? -1 : 1

/** Groups day keys into runs of consecutive calendar days. */
export function toRuns(days: Iterable<string>): DayRun[] {
  const runs: DayRun[] = []
  for (const d of [...new Set(days)].sort()) {
    const last = runs[runs.length - 1]
    if (last && addDays(last.end, 1) === d) {
      last.end = d
      last.days++
    } else runs.push({ start: d, end: d, days: 1 })
  }
  return runs
}

const total = (runs: DayRun[]) => runs.reduce((n, r) => n + r.days, 0)

/** Whole days from a to b (b later), immune to DST because it works in UTC. */
export function daysBetween(a: string, b: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

export function reviewUpload(saved: ParsedUpload, incoming: ParsedUpload): UploadReview {
  const blocked =
    saved.granularity !== incoming.granularity
      ? 'granularity'
      : saved.serviceRef && incoming.serviceRef && saved.serviceRef !== incoming.serviceRef
        ? 'meter'
        : null

  const savedKeys = new Set(saved.readings.map(keyOf))
  const savedDays = new Set(saved.readings.map((r) => r.d))
  const fileDays = new Set(incoming.readings.map((r) => r.d))
  // A day counts as overlapping only where a reading actually collides, so an
  // hourly file that picks up at 1 PM on the day the saved data stops at noon
  // completes that day rather than being flagged against it.
  const overlapDays: string[] = []
  const addedDays: string[] = []
  for (const r of incoming.readings) (savedKeys.has(keyOf(r)) ? overlapDays : addedDays).push(r.d)

  // Walk the combined span for days nobody covers. Inside the saved history's
  // own span those holes predate this file: worth saying when it fills them,
  // not worth repeating when it does not.
  const start = saved.periodStart < incoming.periodStart ? saved.periodStart : incoming.periodStart
  const end = saved.periodEnd > incoming.periodEnd ? saved.periodEnd : incoming.periodEnd
  const gapDays: string[] = []
  const fillDays: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (savedDays.has(d)) continue
    const insideSaved = d >= saved.periodStart && d <= saved.periodEnd
    if (fileDays.has(d)) {
      if (insideSaved) fillDays.push(d)
    } else if (!insideSaved) gapDays.push(d)
  }

  const overlap = toRuns(overlapDays)
  const gaps = toRuns(gapDays)
  const added = toRuns(addedDays)
  return {
    blocked,
    overlap,
    overlapDays: total(overlap),
    gaps,
    gapDays: total(gaps),
    fills: toRuns(fillDays),
    added,
    addedDays: total(added),
  }
}

/** 'pge_sep.csv + 2 earlier files': the newest file, and how many came before. */
export function historyName(sources: string[]): string {
  const latest = sources[sources.length - 1] ?? 'upload.csv'
  const earlier = sources.length - 1
  return earlier > 0 ? `${latest} + ${earlier} earlier file${earlier === 1 ? '' : 's'}` : latest
}

/**
 * The saved history with the new file folded in. The result is read back from
 * the CSV it will be stored as, so what the dashboard shows now is exactly
 * what loads from the account later.
 */
export function mergeUploads(
  saved: ParsedUpload,
  incoming: ParsedUpload,
  choice: OverlapChoice,
): ParsedUpload {
  const byKey = new Map<string, Reading>()
  for (const r of saved.readings) byKey.set(keyOf(r), r)
  for (const r of incoming.readings) {
    const k = keyOf(r)
    if (choice === 'replace' || !byKey.has(k)) byKey.set(k, r)
  }
  const sources = [...(saved.sources ?? [saved.fileName]), incoming.fileName]
  const csv = toGreenButtonCsv({
    fuel: saved.fuel,
    unit: saved.unit,
    granularity: saved.granularity,
    readings: [...byKey.values()].sort(byTime),
    serviceRef: saved.serviceRef ?? incoming.serviceRef,
    sources,
  })
  return parseGreenButtonCsv(csv, historyName(sources))
}
