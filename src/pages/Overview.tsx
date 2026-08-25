import type { CSSProperties } from 'react'
import type { Hearth } from '../types'
import { getDataset } from '../lib/data'
import { seriesPath } from '../lib/svg'
import { questionProgress } from '../model'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
}

interface Kpi {
  label: string
  value: string
  unit: string
  sub: string
  spark: boolean
  sparkLine?: string
  sparkArea?: string
  sparkColor?: string
  sparkFill?: string
}

export function Overview({ hearth }: { hearth: Hearth }) {
  const { elec, acc, accSoft } = hearth
  const D = getDataset()
  const days = elec ? D.days : D.gdays
  const usage = days.map((d) => d.usage)
  const cost = days.map((d) => d.cost)

  const sp = seriesPath(usage.slice(-14), 120, 32, 2)
  const spC = seriesPath(cost.slice(-14), 120, 32, 2)

  const kpis: Kpi[] = elec
    ? [
        { label: 'Total usage', value: '1,687.8', unit: 'kWh', sub: '56.3 kWh avg per day', spark: true, sparkLine: sp.line, sparkArea: sp.area, sparkColor: acc, sparkFill: accSoft },
        { label: 'Total cost', value: '$686.10', unit: '', sub: '$22.87 avg per day', spark: true, sparkLine: spC.line, sparkArea: spC.area, sparkColor: 'rgb(174,134,232)', sparkFill: 'rgba(174,134,232,0.14)' },
        { label: 'Projected bill · this cycle', value: '$214', unit: '', sub: 'Day 18 of 31 · on pace', spark: false },
        { label: 'Always-on load', value: '0.42', unit: 'kWh/hr', sub: '≈ $37/mo of standby', spark: false },
      ]
    : [
        { label: 'Total usage', value: '24.3', unit: 'therms', sub: '0.81 therms avg per day', spark: true, sparkLine: sp.line, sparkArea: sp.area, sparkColor: acc, sparkFill: accSoft },
        { label: 'Total cost', value: '$38.20', unit: '', sub: '$1.27 avg per day', spark: true, sparkLine: spC.line, sparkArea: spC.area, sparkColor: 'rgb(174,134,232)', sparkFill: 'rgba(174,134,232,0.14)' },
        { label: 'Projected bill · this cycle', value: '$41', unit: '', sub: 'Day 18 of 31 · on pace', spark: false },
        { label: 'Active gas days', value: '11', unit: 'of 30', sub: '≈ 1.06 therms when on', spark: false },
      ]

  const savings = elec
    ? [
        { label: 'Shift flexible loads off 4–9 PM', amt: '$168/yr', w: '100%' },
        { label: 'Pre-cool before the peak', amt: '$96/yr', w: '57%' },
        { label: 'Trim always-on phantom load', amt: '$80/yr', w: '48%' },
      ]
    : [
        { label: 'Shorter showers, same comfort', amt: '$26/yr', w: '100%' },
        { label: 'Wash clothes cold', amt: '$14/yr', w: '54%' },
        { label: 'Fix the pilot-light draw', amt: '$9/yr', w: '35%' },
      ]
  const savingsTotal = elec ? '$344' : '$49'

  const insights = elec
    ? [
        { icon: 'ph-fill ph-warning-circle', color: 'rgb(255,133,115)', title: '31% of your cost lands in the 4–9 PM peak', chip: '~$168/yr', body: 'Peak power costs $0.52 vs $0.39 off-peak. Laundry, dishwasher and EV charging can all move.' },
        { icon: 'ph-fill ph-check-circle', color: 'rgb(4,196,10)', title: 'Your always-on load is modest', chip: '', body: '0.42 kWh every hour — about $37/mo of standby. Below typical for a house your size.' },
        { icon: 'ph-fill ph-info', color: 'rgb(41,149,255)', title: 'Cool nights this week are free AC', chip: '', body: 'Overnight lows run 14° below your setpoint. Open windows after 9 PM, close by 8 AM.' },
      ]
    : [
        { icon: 'ph-fill ph-info', color: 'rgb(41,149,255)', title: 'Summer gas is mostly hot water', chip: '', body: 'Heating is off — the steady ~1.06 therm days are your water heater and stove.' },
        { icon: 'ph-fill ph-check-circle', color: 'rgb(4,196,10)', title: '19 of 30 days used almost no gas', chip: '', body: 'Your baseline is healthy. Nothing looks stuck on.' },
        { icon: 'ph-fill ph-warning-circle', color: 'rgb(255,133,115)', title: 'One unusual day: Aug 20', chip: '', body: '2.1 therms — about double a normal active day. Guests, extra laundry, or a long shower marathon?' },
      ]

  const mini = seriesPath(usage, 720, 150, 4)
  const metricLabel =
    hearth.metric === 'usage' ? (elec ? 'usage (kWh)' : 'usage (therms)') : 'cost ($)'
  const eventCount = elec ? 4 : 2
  const { qProg, qProgW } = questionProgress(hearth.answers, hearth.fuel)

  const uploads = elec
    ? [
        { icon: 'ph-fill ph-lightning', color: 'rgb(255,221,85)', name: 'pge_electric_usage_jul-aug.csv', range: 'Jul 25 – Aug 23 · hourly · 720 rows', viewing: true, total: '1,687.8 kWh · $686.10' },
        { icon: 'ph-fill ph-flame', color: 'rgb(41,149,255)', name: 'pge_gas_usage_jul-aug.csv', range: 'Jul 25 – Aug 23 · daily · 30 rows', viewing: false, total: '24.3 therms · $38.20' },
      ]
    : [
        { icon: 'ph-fill ph-flame', color: 'rgb(41,149,255)', name: 'pge_gas_usage_jul-aug.csv', range: 'Jul 25 – Aug 23 · daily · 30 rows', viewing: true, total: '24.3 therms · $38.20' },
        { icon: 'ph-fill ph-lightning', color: 'rgb(255,221,85)', name: 'pge_electric_usage_jul-aug.csv', range: 'Jul 25 – Aug 23 · hourly · 720 rows', viewing: false, total: '1,687.8 kWh · $686.10' },
      ]

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
              {k.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.025em', lineHeight: 1 }}>
              {k.value}
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-3)', marginLeft: 5 }}>{k.unit}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{k.sub}</div>
            {k.spark && (
              <svg viewBox="0 0 120 32" style={{ width: '100%', height: 32, display: 'block' }} preserveAspectRatio="none">
                <path d={k.sparkArea} fill={k.sparkFill} />
                <path d={k.sparkLine} fill="none" stroke={k.sparkColor} strokeWidth="1.5" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Savings at a glance</div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>if you act on all three</div>
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: '-0.025em', lineHeight: 1 }}>
            {savingsTotal}
            <span style={{ fontSize: 14, color: 'var(--fg-3)', fontWeight: 500 }}> /yr</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savings.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{s.label}</span>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{s.amt}</span>
                </div>
                <div style={{ height: 5, borderRadius: 100, background: 'var(--bg-4)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 100, background: 'var(--accent-green)', opacity: 0.85, width: s.w }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Insights</div>
          {insights.map((ins) => (
            <div key={ins.title} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '11px 12px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)' }}>
              <i className={ins.icon} style={{ fontSize: 17, flex: 'none', marginTop: 1, color: ins.color }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {ins.title}
                  {ins.chip && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)', background: 'rgba(4,196,10,0.12)', borderRadius: 100, padding: '2px 8px' }}>
                      {ins.chip}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3, lineHeight: 1.45 }}>{ins.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Daily {metricLabel}</div>
          <button
            onClick={() => hearth.go('energy')}
            className="h-interactive hov-bright"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--acc,#ffdd55)', padding: 0 }}
          >
            Open Energy <i className="ph ph-caret-right" style={{ fontSize: 11 }} />
          </button>
        </div>
        <svg viewBox="0 0 720 150" style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
          <path d={mini.area} fill="var(--accSoft,rgba(255,221,85,.13))" />
          <path d={mini.line} fill="none" stroke="var(--acc,#ffdd55)" strokeWidth="1.75" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)' }}>
          <span>JUL 25</span>
          <span>AUG 8</span>
          <span>AUG 23</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <button
          onClick={() => hearth.go('playbook')}
          className="h-interactive card-btn press99"
          style={{ textAlign: 'left', ...card, padding: 20, cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--fg-1)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
            <i className="ph ph-snowflake" style={{ color: 'var(--accent-blue)', fontSize: 17 }} />
            Today's AC plan
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: 'var(--fg-4)' }}>Standard day · high 84°</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 110, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>PRE-COOL · 1 PM</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-blue)', marginTop: 4 }}>72°</div>
            </div>
            <div style={{ flex: 1, minWidth: 110, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>PEAK · 4–9 PM</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-0)', marginTop: 4 }}>78°</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            Chill the house while power is cheap, then let it coast.{' '}
            <span style={{ color: 'var(--acc,#ffdd55)', fontWeight: 600 }}>Full playbook →</span>
          </div>
        </button>

        <button
          onClick={() => hearth.go('activity')}
          className="h-interactive card-btn press99"
          style={{ textAlign: 'left', ...card, padding: 20, cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--fg-1)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
            <i className="ph ph-pulse" style={{ color: 'var(--accent-coral)', fontSize: 17 }} />
            Activity
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
            {eventCount} events flagged this period — one high-severity evening spike is worth a look.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 100, background: 'var(--bg-4)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--acc,#ffdd55)', width: qProgW, borderRadius: 100 }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{qProg} questions answered</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            Answering sharpens every estimate.{' '}
            <span style={{ color: 'var(--acc,#ffdd55)', fontWeight: 600 }}>Review →</span>
          </div>
        </button>
      </div>

      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Your data</div>
          <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
            Cycle Jul 24 – Aug 23 ·{' '}
            <a href="#" onClick={(e) => e.preventDefault()}>
              edit
            </a>
          </div>
        </div>
        {uploads.map((u) => (
          <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', flexWrap: 'wrap' }}>
            <i className={u.icon} style={{ fontSize: 17, color: u.color, flex: 'none' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {u.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>{u.range}</div>
            </div>
            {u.viewing && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc,#ffdd55)', background: 'var(--accSoft,rgba(255,221,85,.13))', borderRadius: 100, padding: '3px 9px', flex: 'none' }}>
                viewing
              </span>
            )}
            <div style={{ fontSize: 12, color: 'var(--fg-3)', flex: 'none' }}>{u.total}</div>
          </div>
        ))}
      </div>
    </>
  )
}
