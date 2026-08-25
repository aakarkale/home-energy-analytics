import type { CSSProperties } from 'react'
import type { Hearth } from '../types'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
}

export function Playbook({ hearth }: { hearth: Hearth }) {
  const { plan } = hearth
  const hasElectric = !!hearth.bundles.electric

  return (
    <>
      {!hasElectric && hearth.mode === 'live' && (
        <div style={{ ...card, padding: 20, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
          <i className="ph ph-info" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
          Upload hourly electricity data and the schedule below anchors to your own detected peak window.
          Right now it shows the standard 4–9 PM plan.
        </div>
      )}

      {plan.hasAC ? (
        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Your thermostat schedule</div>
            {plan.summerChip && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(4,196,10,0.12)', borderRadius: 100, padding: '3px 9px' }}>
                {plan.summerChip}
              </span>
            )}
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-4)' }}>
              Times derived from your detected {plan.windowLabel} peak
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            {plan.schedule.map((s) => (
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
      ) : (
        <div style={{ ...card, padding: 20, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
          <i className="ph ph-wind" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
          No AC configured, so skip the thermostat schedule. Night flush and the habits below still apply.
        </div>
      )}

      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Next 7 days</div>
          {plan.forecast && hearth.forecastIsSample && (
            <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>sample forecast · demo mode</span>
          )}
        </div>
        {plan.forecast ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(88px,1fr))', gap: 8 }}>
            {plan.forecast.map((f, i) => (
              <div key={i} style={{ borderRadius: 12, padding: '12px 8px', textAlign: 'center', background: f.bg, border: `1px solid ${f.border}`, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--fg-3)', fontSize: 13, flexWrap: 'wrap' }}>
            <i className="ph ph-cloud-sun" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
            {hearth.zipMissing
              ? 'Add your ZIP code in setup to see a live 7-day forecast with temperature bands.'
              : 'Forecast unavailable right now. The bands below still explain how the plan adapts.'}
            {hearth.zipMissing && (
              <button
                onClick={() => hearth.openOb(1)}
                className="h-interactive hov-bright"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--acc,#ffdd55)', padding: 0 }}
              >
                Add ZIP →
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        {plan.nightFlush && (
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
              <i className="ph ph-wind" style={{ color: 'var(--accent-blue)', fontSize: 18 }} />
              Night flush
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--accent-blue)', lineHeight: 1 }}>
                {plan.nightFlush.delta}°
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>cooler outside than your setpoint, most nights this week</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
              Open windows when peak ends at <b style={{ color: 'var(--fg-1)' }}>{plan.nightFlush.openAt}</b>, close
              them by <b style={{ color: 'var(--fg-1)' }}>{plan.nightFlush.closeBy}</b>. That's free
              air-conditioning: the AC starts the day from a cool house.
            </div>
          </div>
        )}

        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>This week's bands</div>
          {plan.bands.map((bd) => (
            <div key={bd.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--bg-6)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 100, background: bd.dot, flex: 'none' }} />
              <span style={{ color: 'var(--fg-1)', fontWeight: 600, minWidth: 76 }}>{bd.name}</span>
              <span style={{ color: 'var(--fg-4)', flex: 1 }}>{bd.range}</span>
              {plan.forecast && <span style={{ color: 'var(--fg-2)', fontWeight: 600 }}>{bd.count}</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Two habits, one honest note</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          <i className="ph ph-sun-horizon" style={{ fontSize: 16, color: 'var(--acc,#ffdd55)', flex: 'none', marginTop: 2 }} />
          Close west- and south-facing blinds by noon. Sun through glass is a space heater.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
          <i className="ph ph-fan" style={{ fontSize: 16, color: 'var(--acc,#ffdd55)', flex: 'none', marginTop: 2 }} />
          Leave the fan on Auto: "On" runs the blower all day for little comfort gain.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5, borderTop: '1px solid var(--bg-6)', paddingTop: 10, marginTop: 2 }}>
          <i className="ph ph-hand-heart" style={{ fontSize: 16, color: 'var(--fg-4)', flex: 'none', marginTop: 2 }} />
          {plan.peak.temp} at peak is a real comfort change. A temperature you'll actually keep beats the
          theoretical optimum. Adjust the plan, not your patience.
        </div>
      </div>
    </>
  )
}
