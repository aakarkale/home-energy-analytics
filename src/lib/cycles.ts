// Billing cycles across a stretch of readings.
//
// PG&E bills in cycles of about a month. The user confirms one cycle when they
// upload; the rest are stepped out from it at the same length, which lands
// within a day or two of PG&E's own schedule. Everything that talks about
// cycles (the allowance on Rates, the bill projection, the cycle dots on the
// daily chart and the bills-by-cycle tile) walks them from here, so they agree.

import { addDays, dateFromKey } from './format'

export interface CycleWindow {
  start: string
  end: string
}

/** The confirmed cycle's length in days, or null when it is not a plausible
 *  monthly cycle (20 to 40 days), as when it was left spanning a whole file. */
export function cycleLength(billing: CycleWindow): number | null {
  const len =
    Math.round((dateFromKey(billing.end).getTime() - dateFromKey(billing.start).getTime()) / 86400000) + 1
  return len >= 20 && len <= 40 ? len : null
}

/** Every cycle that overlaps `from`–`to`, oldest first. Empty when the
 *  confirmed cycle is not a monthly one. */
export function cycleWindows(billing: CycleWindow, from: string, to: string): CycleWindow[] {
  const len = cycleLength(billing)
  if (!len) return []
  let start = billing.start
  while (start > from) start = addDays(start, -len)
  while (addDays(start, len - 1) < from) start = addDays(start, len)
  const out: CycleWindow[] = []
  for (; start <= to; start = addDays(start, len)) out.push({ start, end: addDays(start, len - 1) })
  return out
}
