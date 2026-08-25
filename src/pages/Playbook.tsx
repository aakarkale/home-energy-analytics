import type { CSSProperties } from 'react'
import type { Hearth } from '../types'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
}

const SCHEDULE = [
  { period: 'Wake', time: '6 AM', temp: '76°', why: "Coast on last night's cool air.", bg: 'var(--bg-3)', border: 'var(--bg-6)', labelColor: 'var(--fg-4)', tempColor: 'var(--fg-0)' },
  { period: 'Pre-cool', time: '1 PM', temp: '72°', why: 'Chill the house while power is cheap.', bg: 'rgba(41,149,255,0.09)', border: 'rgba(41,149,255,0.3)', labelColor: 'rgb(41,149,255)', tempColor: 'rgb(41,149,255)' },
  { period: 'Peak', time: '4–9 PM', temp: '78°', why: 'Keep the lid shut — the AC mostly rests.', bg: 'rgba(255,221,85,0.08)', border: 'rgba(255,221,85,0.3)', labelColor: 'rgb(255,221,85)', tempColor: 'var(--fg-0)' },
  { period: 'Evening', time: '9 PM', temp: '74°', why: 'Cheap power returns.', bg: 'var(--bg-3)', border: 'var(--bg-6)', labelColor: 'var(--fg-4)', tempColor: 'var(--fg-0)' },
]

const BAND_COLOR: Record<string, string> = {
  Standard: 'var(--fg-4)',
  Hot: 'rgb(255,133,115)',
  Extreme: 'rgb(255,69,56)',
  Off: 'rgb(41,149,255)',
}

const FC: [string, number, number, string, string][] = [
  ['MON', 84, 61, 'ph ph-sun', 'Standard'],
  ['TUE', 87, 63, 'ph ph-sun', 'Standard'],
  ['WED', 91, 66, 'ph ph-cloud-sun', 'Hot'],
  ['THU', 95, 68, 'ph ph-sun', 'Hot'],
  ['FRI', 97, 70, 'ph ph-thermometer-hot', 'Extreme'],
  ['SAT', 88, 64, 'ph ph-cloud-sun', 'Hot'],
  ['SUN', 82, 60, 'ph ph-cloud-sun', 'Standard'],
]

const FORECAST = FC.map(([day, hi, lo, icon, band]) => ({
  day,
  hi,
  lo,
  icon,
  band,
  bandColor: BAND_COLOR[band],
  iconColor: band === 'Extreme' ? 'rgb(255,69,56)' : band === 'Hot' ? 'rgb(255,133,115)' : 'var(--fg-3)',
  bg: band === 'Extreme' ? 'rgba(255,69,56,0.08)' : 'var(--bg-3)',
  border: band === 'Extreme' ? 'rgba(255,69,56,0.35)' : 'var(--bg-6)',
}))

const BANDS = [
  { name: 'Off', range: 'below 78° — windows do the work', count: '0 days', dot: 'rgb(41,149,255)' },
  { name: 'Standard', range: '78–88° — pre-cool 72°, peak 78°', count: '3 days', dot: 'var(--fg-4)' },
  { name: 'Hot', range: '88–95° — pre-cool 70°, peak 77°', count: '3 days', dot: 'rgb(255,133,115)' },
  { name: 'Extreme', range: 'above 95° — comfort first', count: '1 day', dot: 'rgb(255,69,56)' },
]

export function Playbook(_props: { hearth: Hearth }) {
  return (
    <>
      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Your thermostat schedule</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(4,196,10,0.12)', borderRadius: 100, padding: '3px 9px' }}>
            ~$96 this summer
          </span>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-4)' }}>
            Times derived from your detected 4–9 PM peak
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {SCHEDULE.map((s) => (
            <div key={s.period} style={{ borderRadius: 14, padding: 14, background: s.bg, border: `1px solid ${s.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: s.labelColor }}>
                  {s.period}
                </span>
                <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{s.time}</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', color: s.tempColor, lineHeight: 1 }}>{s.temp}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.4 }}>{s.why}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Next 7 days</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(88px,1fr))', gap: 8 }}>
          {FORECAST.map((f) => (
            <div key={f.day} style={{ borderRadius: 12, padding: '12px 8px', textAlign: 'center', background: f.bg, border: `1px solid ${f.border}`, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: 'var(--fg-4)' }}>{f.day}</div>
              <i className={f.icon} style={{ fontSize: 20, color: f.iconColor }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
                {f.hi}°<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-4)' }}> /{f.lo}°</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: f.bandColor }}>
                {f.band}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
            <i className="ph ph-wind" style={{ color: 'var(--accent-blue)', fontSize: 18 }} />
            Night flush
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--accent-blue)', lineHeight: 1 }}>14°</div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>cooler outside than your setpoint, most nights this week</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
            Open windows when peak ends at <b style={{ color: 'var(--fg-1)' }}>9 PM</b>, close them by{' '}
            <b style={{ color: 'var(--fg-1)' }}>8 AM</b>. That's free air-conditioning — the AC starts the day from a cool house.
          </div>
        </div>

        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>This week's bands</div>
          {BANDS.map((bd) => (
            <div key={bd.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--bg-6)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 100, background: bd.dot, flex: 'none' }} />
              <span style={{ color: 'var(--fg-1)', fontWeight: 600, minWidth: 76 }}>{bd.name}</span>
              <span style={{ color: 'var(--fg-4)', flex: 1 }}>{bd.range}</span>
              <span style={{ color: 'var(--fg-2)', fontWeight: 600 }}>{bd.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Two habits, one honest note</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          <i className="ph ph-sun-horizon" style={{ fontSize: 16, color: 'var(--acc,#ffdd55)', flex: 'none', marginTop: 2 }} />
          Close west- and south-facing blinds by noon — sun through glass is a space heater.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          <i className="ph ph-fan" style={{ fontSize: 16, color: 'var(--acc,#ffdd55)', flex: 'none', marginTop: 2 }} />
          Leave the fan on Auto — "On" runs the blower all day for little comfort gain.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5, borderTop: '1px solid var(--bg-6)', paddingTop: 10, marginTop: 2 }}>
          <i className="ph ph-hand-heart" style={{ fontSize: 16, color: 'var(--fg-4)', flex: 'none', marginTop: 2 }} />
          78° at peak is a real comfort change. A temperature you'll actually keep beats the theoretical optimum — adjust the plan, not your patience.
        </div>
      </div>
    </>
  )
}
