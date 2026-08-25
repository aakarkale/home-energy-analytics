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

const CACHE_MS = 60 * 60 * 1000

export async function getForecast(zip: string): Promise<ForecastDay[] | null> {
  if (!/^\d{5}$/.test(zip)) return null
  const cacheKey = `hearth-forecast-${zip}`
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      const { ts, days } = JSON.parse(raw)
      if (Date.now() - ts < CACHE_MS && Array.isArray(days)) return days
    }
  } catch {
    /* ignore */
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
      `&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`
    const wxRes = await fetch(url)
    if (!wxRes.ok) return null
    const wx = await wxRes.json()
    const dates: string[] = wx?.daily?.time ?? []
    const his: number[] = wx?.daily?.temperature_2m_max ?? []
    const los: number[] = wx?.daily?.temperature_2m_min ?? []
    const codes: number[] = wx?.daily?.weathercode ?? []
    if (!dates.length) return null

    const days: ForecastDay[] = dates.slice(0, 7).map((d, i) => ({
      day: new Date(d + 'T12:00:00')
        .toLocaleDateString('en-US', { weekday: 'short' })
        .toUpperCase(),
      hi: Math.round(his[i]),
      lo: Math.round(los[i]),
      code: codes[i] ?? 0,
    }))
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), days }))
    } catch {
      /* ignore */
    }
    return days
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
