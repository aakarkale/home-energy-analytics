// PG&E "Green Button — Download my data" CSV parser.
// Auto-detects fuel (kWh → electric, therms → gas) and granularity (hourly
// rows carry a START TIME). Tolerates the metadata preamble (Name, Address,
// Account Number …), quoted fields, $-prefixed costs, and estimated-reading
// notes. Everything runs client-side; nothing leaves the browser until the
// user chooses to save an upload to their account.

import type { Fuel } from '../types'

export interface Reading {
  /** YYYY-MM-DD */
  d: string
  /** Hour of day 0-23; absent for daily readings. */
  h?: number
  usage: number
  cost: number
  est?: boolean
}

export interface ParsedUpload {
  fuel: Fuel
  unit: 'kWh' | 'therms'
  granularity: 'hourly' | 'daily'
  fileName: string
  readings: Reading[]
  periodStart: string
  periodEnd: string
  rowCount: number
  totalUsage: number
  totalCost: number
  serviceRef?: string
  /** The raw CSV text (stored server-side only when the user saves). */
  csv: string
}

export class ParseError extends Error {}

/** Split one CSV line honoring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function parseDate(raw: string): string | null {
  const t = raw.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return null
}

function parseMoney(raw: string): number {
  const t = raw.replace(/[$,\s"]/g, '')
  if (!t) return 0
  const neg = /^\(.*\)$/.test(t)
  const v = parseFloat(t.replace(/[()]/g, ''))
  if (!Number.isFinite(v)) return 0
  return neg ? -v : v
}

export function parseGreenButtonCsv(csv: string, fileName: string): ParsedUpload {
  const lines = csv.split(/\r\n|\n|\r/)

  let serviceRef: string | undefined
  let headerIdx = -1
  let header: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const upper = cells.map((c) => c.toUpperCase())
    if (upper[0]?.startsWith('ACCOUNT NUMBER') && cells[1]) {
      serviceRef = cells[1].slice(-4)
    }
    if (upper.includes('DATE') && upper.some((c) => c.startsWith('USAGE'))) {
      headerIdx = i
      header = upper
      break
    }
  }
  if (headerIdx < 0) {
    throw new ParseError(
      "Couldn't find a data header row. Expected a PG&E Green Button CSV with DATE and USAGE columns.",
    )
  }

  const col = (name: string) => header.findIndex((h) => h === name || h.startsWith(name))
  const cType = col('TYPE')
  const cDate = col('DATE')
  const cStart = col('START TIME')
  const cUsage = col('USAGE')
  const cUnits = col('UNITS')
  const cCost = col('COST')
  const cNotes = col('NOTES')

  // Unit from the UNITS column or from a "USAGE (kWh)"-style header.
  const usageHeader = header[cUsage] || ''
  const headerUnit = /THERM/.test(usageHeader) ? 'therms' : /KWH/.test(usageHeader) ? 'kWh' : null

  const byKey = new Map<string, Reading>()
  let unitSeen: 'kWh' | 'therms' | null = headerUnit
  let typeSeen = ''
  let hourly = false

  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cells = splitCsvLine(lines[i])
    const d = parseDate(cells[cDate] ?? '')
    if (!d) continue
    const usage = parseFloat((cells[cUsage] ?? '').replace(/[",]/g, ''))
    if (!Number.isFinite(usage)) continue

    if (cUnits >= 0 && cells[cUnits]) {
      const u = cells[cUnits].toLowerCase()
      if (u.includes('therm')) unitSeen = 'therms'
      else if (u.includes('kwh')) unitSeen = 'kWh'
    }
    if (cType >= 0 && cells[cType]) typeSeen = cells[cType].toLowerCase()

    let h: number | undefined
    const start = cStart >= 0 ? (cells[cStart] ?? '') : ''
    const hm = /^(\d{1,2}):(\d{2})/.exec(start)
    if (hm) {
      h = Math.min(23, Math.max(0, parseInt(hm[1], 10)))
      hourly = true
    }

    const cost = cCost >= 0 ? parseMoney(cells[cCost] ?? '') : 0
    const est = cNotes >= 0 && /estimat/i.test(cells[cNotes] ?? '')

    const key = h === undefined ? d : `${d}#${h}`
    const prev = byKey.get(key)
    if (prev) {
      // DST fold / duplicate interval: merge by summing.
      prev.usage += usage
      prev.cost += cost
      prev.est = prev.est || est
    } else {
      byKey.set(key, { d, ...(h !== undefined ? { h } : {}), usage, cost, ...(est ? { est: true } : {}) })
    }
  }

  const readings = [...byKey.values()].sort((a, b) =>
    a.d === b.d ? (a.h ?? 0) - (b.h ?? 0) : a.d < b.d ? -1 : 1,
  )
  if (!readings.length) {
    throw new ParseError('No usable rows found — every row was missing a date or usage value.')
  }

  const unit: 'kWh' | 'therms' =
    unitSeen ?? (typeSeen.includes('gas') ? 'therms' : 'kWh')
  const fuel: Fuel = unit === 'therms' ? 'gas' : 'electric'

  return {
    fuel,
    unit,
    granularity: hourly ? 'hourly' : 'daily',
    fileName,
    readings,
    periodStart: readings[0].d,
    periodEnd: readings[readings.length - 1].d,
    rowCount: readings.length,
    totalUsage: readings.reduce((a, r) => a + r.usage, 0),
    totalCost: readings.reduce((a, r) => a + r.cost, 0),
    ...(serviceRef ? { serviceRef } : {}),
    csv,
  }
}
