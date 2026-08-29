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

/** The forecast is never allowed to be older than this. A tab left open gets a
 *  refresh on this interval, and one that wakes up staler than this refetches. */
export const REFRESH_MS = 12 * 60 * 60 * 1000

export interface ForecastResult {
  days: ForecastDay[]
  /** Outdoor °F for every hour, index 0 = midnight local today. Lets the
   *  playbook draw today's curve under the thermostat schedule. */
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
        const { ts, days, hoursF } = JSON.parse(raw)
        if (Date.now() - ts < CACHE_MS && Array.isArray(days)) {
          return { days, hoursF: Array.isArray(hoursF) ? hoursF : [], fetchedAt: ts }
        }
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const geoRes = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!geoRes.ok) return null
    const geo = await geoRes.json()
    const place = geo?.places?.[0]
    const lat = parseFloat(place?.latitude)
    const lon = parseFloat(place?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&hourly=temperature_2m` +
      `&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`
    const wxRes = await fetch(url)
    if (!wxRes.ok) return null
    const wx = await wxRes.json()
    const dates: string[] = wx?.daily?.time ?? []
    const his: number[] = wx?.daily?.temperature_2m_max ?? []
    const los: number[] = wx?.daily?.temperature_2m_min ?? []
    const codes: number[] = wx?.daily?.weathercode ?? []
    if (!dates.length) return null
    // Hourly comes back as one flat series from midnight of the first day.
    const hoursF: number[] = (wx?.hourly?.temperature_2m ?? [])
      .slice(0, 48)
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
      localStorage.setItem(cacheKey, JSON.stringify({ ts: fetchedAt, days, hoursF }))
    } catch {
      /* ignore */
    }
    return { days, hoursF, fetchedAt }
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
