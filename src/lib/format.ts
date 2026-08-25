// Number / date / hour formatting shared by the engine and the UI.

export const fmtNum = (v: number, dp = 1) =>
  v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const fmtMoney = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtMoney0 = (v: number) => '$' + Math.round(v).toLocaleString('en-US')

/** v ≥ 100 → rounded with thousands separator, else one decimal. */
export const fmt1 = (v: number) => (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1))

export function dateFromKey(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export const dowOf = (d: string) => dateFromKey(d).getDay()

/** 'Thu Aug 3' */
export const fmtDayShort = (d: string) =>
  dateFromKey(d)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(/,/g, '')

/** 'Aug 7' */
export const fmtMonthDay = (d: string) =>
  dateFromKey(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** 'Aug 23, 2026' */
export const fmtFullDate = (d: string) =>
  dateFromKey(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const weekdayName = (d: string) =>
  dateFromKey(d).toLocaleDateString('en-US', { weekday: 'long' })

/** hour 0-23 → '12 AM', '1 PM' … */
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`

/** hour 0-23 → '12A', '4P' … (compact, no space) */
export const hourShort = (h: number) => `${h % 12 || 12}${h < 12 ? ' AM' : ' PM'}`

/** [16, 21) → '4–9 PM'; [9,14) → '9 AM–2 PM' */
export function windowLabel(startH: number, endH: number): string {
  const sMer = startH < 12 ? 'AM' : 'PM'
  const eMer = endH < 12 ? 'AM' : 'PM'
  const s = `${startH % 12 || 12}`
  const e = `${endH % 12 || 12}`
  return sMer === eMer ? `${s}–${e} ${eMer}` : `${s} ${sMer}–${e} ${eMer}`
}

/** 'JUL 25 – AUG 23 · 30 DAYS' */
export function rangeLabel(start: string, end: string, days: number): string {
  const f = (d: string) =>
    dateFromKey(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
  return `${f(start)} – ${f(end)} · ${days} DAYS`
}

export function addDays(d: string, n: number): string {
  const dt = dateFromKey(d)
  dt.setDate(dt.getDate() + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
