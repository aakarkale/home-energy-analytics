// Optional weather enrichment: ZIP → 7-day forecast via zippopotam.us
// geocoding + Open-Meteo (both free, keyless, CORS-friendly). Failures
// degrade gracefully — the playbook simply shows its no-forecast state.

export interface ForecastDay {
  /** 'MON' */
  day: string
  hi: number
  lo: number
  code: number
}

/** Reads inside this window are served from cache, so moving between pages
 *  does not re-hit the API. A forced refresh ignores it. */
const CACHE_MS = 60 * 60 * 1000

/** A ZIP's coordinates do not change, so the geocode is kept for good. This is
 *  what lets a refresh be one request instead of two, and it means a
 *  zippopotam outage cannot block a forecast for a ZIP already seen. */
const GEO_KEY = 'hearth-geo'

/** Local yyyy-mm-dd, matching the date strings Open-Meteo returns for
 *  timezone=auto. Not toISOString, which would shift to UTC and hand back
 *  yesterday for anyone west of Greenwich in the evening. */
function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Whole days from one yyyy-mm-dd to another, both read as local midnight. */
function daysBetween(from: string, to: string): number | null {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/** Re-anchor the flat hourly series so index 0 is midnight *today*, whatever
 *  day it was fetched on. A tab left open overnight would otherwise draw
 *  yesterday's curve under today's schedule. */
function hoursForToday(hoursF: number[], startDate: string): number[] {
  const offset = daysBetween(startDate, localDate())
  if (offset === null || offset < 0) return []
  const from = offset * 24
  return from >= hoursF.length ? [] : hoursF.slice(from)
}

async function geocode(zip: string): Promise<{ lat: number; lon: number } | null> {
  let cache: Record<string, { lat: number; lon: number }> = {}
  try {
    cache = JSON.parse(localStorage.getItem(GEO_KEY) || '{}')
    const hit = cache?.[zip]
    if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) return hit
  } catch {
    cache = {}
  }
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
  if (!res.ok) return null
  const place = (await res.json())?.places?.[0]
  const lat = parseFloat(place?.latitude)
  const lon = parseFloat(place?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  try {
    localStorage.setItem(GEO_KEY, JSON.stringify({ ...cache, [zip]: { lat, lon } }))
  } catch {
    /* ignore */
  }
  return { lat, lon }
}

/** The forecast is never allowed to be older than this. A tab left open gets a
 *  refresh on this interval, and one that wakes up staler than this refetches. */
export const REFRESH_MS = 12 * 60 * 60 * 1000

export interface ForecastResult {
  days: ForecastDay[]
  /** Outdoor °F for every hour, index 0 = midnight local *today*, re-anchored
   *  on every read so a payload fetched yesterday cannot draw yesterday's
   *  curve. Lets the playbook put today's weather under the schedule. */
  hoursF: number[]
  /** When these numbers came off the API, not when they were read from cache. */
  fetchedAt: number
}

export async function getForecast(
  zip: string,
  opts?: { force?: boolean },
): Promise<ForecastResult | null> {
  if (!/^\d{5}$/.test(zip)) return null
  const cacheKey = `hearth-forecast-${zip}`
  if (!opts?.force) {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const { ts, days, hoursF, startDate } = JSON.parse(raw)
        if (Date.now() - ts < CACHE_MS && Array.isArray(days)) {
          const hrs = Array.isArray(hoursF) && startDate ? hoursForToday(hoursF, startDate) : []
          return { days, hoursF: hrs, fetchedAt: ts }
        }
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const geo = await geocode(zip)
    if (!geo) return null

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&hourly=temperature_2m` +
      `&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`
    // Our own cache is not the only one in the way: the forecast endpoint is
    // cacheable, so without this a "refresh" can be answered by the browser
    // out of its HTTP cache and return the very numbers we are replacing.
    const wxRes = await fetch(url, opts?.force ? { cache: 'no-store' } : undefined)
    if (!wxRes.ok) return null
    const wx = await wxRes.json()
    const dates: string[] = wx?.daily?.time ?? []
    const his: number[] = wx?.daily?.temperature_2m_max ?? []
    const los: number[] = wx?.daily?.temperature_2m_min ?? []
    const codes: number[] = wx?.daily?.weathercode ?? []
    if (!dates.length) return null
    // Hourly comes back as one flat series from midnight of the first day,
    // which is why the first date is stored with it: it is the anchor that
    // hoursForToday needs to find today inside the series later on.
    //
    // Three days, not one: the curve runs 6 AM to 5 AM the next morning, so a
    // single day of hours leaves it six short, and a payload read back the day
    // after it was fetched would have nothing left to draw at all.
    const startDate: string = dates[0]
    const hoursF: number[] = (wx?.hourly?.temperature_2m ?? [])
      .slice(0, 72)
      .map((t: number) => Math.round(t))

    // A malformed date from upstream would otherwise render as "INVALID DATE"
    // in the forecast strip, so drop those rows rather than show them.
    const days: ForecastDay[] = dates
      .slice(0, 7)
      .map((d, i) => {
        const when = new Date(d + 'T12:00:00')
        if (Number.isNaN(when.getTime())) return null
        return {
          day: when.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
          hi: Math.round(his[i]),
          lo: Math.round(los[i]),
          code: codes[i] ?? 0,
        }
      })
      .filter((d): d is ForecastDay => d !== null && Number.isFinite(d.hi) && Number.isFinite(d.lo))
    if (!days.length) return null
    const fetchedAt = Date.now()
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: fetchedAt, days, hoursF, startDate }))
    } catch {
      /* ignore */
    }
    return { days, hoursF: hoursForToday(hoursF, startDate), fetchedAt }
  } catch {
    return null
  }
}

export function weatherIcon(code: number, hi: number): string {
  if (hi >= 96) return 'ph ph-thermometer-hot'
  if (code <= 1) return 'ph ph-sun'
  if (code <= 3) return 'ph ph-cloud-sun'
  if (code === 45 || code === 48) return 'ph ph-cloud-fog'
  if (code >= 95) return 'ph ph-cloud-lightning'
  if (code >= 71 && code <= 77) return 'ph ph-cloud-snow'
  if (code >= 51) return 'ph ph-cloud-rain'
  return 'ph ph-cloud-sun'
}
