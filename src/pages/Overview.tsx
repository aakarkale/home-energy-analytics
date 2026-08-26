import { useEffect, useState, type CSSProperties } from 'react'
import type { Fuel, Hearth } from '../types'
import type { HearthStore } from '../store'
import { seriesPath } from '../lib/svg'
import { fmtDayShort, fmtMoney, fmtMoney0, fmtMonthDay, fmtNum } from '../lib/format'
import { FUEL_ICON } from '../model'
import { EmptyState } from '../components/EmptyState'
import { HoverChart } from '../components/chart'

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
  sparkPts?: [number, number][]
  sparkIsCost?: boolean
}

export function Overview({ hearth, store }: { hearth: Hearth; store: HearthStore }) {
  const { elec, acc, accSoft, bundle, plan } = hearth
  const [save, setSave] = useState<number | null>(null)
  // Meters animate from zero on the first paint after mount.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])
  if (!bundle) return <EmptyState hearth={hearth} />
  const a = bundle.analysis

  const usage = a.daily.map((d) => d.usage)
  const cost = a.daily.map((d) => d.cost)
  const sp = seriesPath(usage.slice(-14), 120, 32, 2)
  const spC = seriesPath(cost.slice(-14), 120, 32, 2)

  const kpis: Kpi[] = [
    {
      label: 'Total usage',
      value: fmtNum(a.totalUsage, 1),
      unit: a.unit,
      sub: `${fmtNum(a.avgUsage, elec ? 1 : 2)} ${a.unit} avg per day`,
      spark: true,
      sparkLine: sp.line,
      sparkArea: sp.area,
      sparkColor: acc,
      sparkFill: accSoft,
      sparkPts: sp.pts,
    },
    {
      label: 'Total cost',
      value: fmtMoney(a.totalCost),
      unit: '',
      sub: `${fmtMoney(a.avgCost)} avg per day`,
      spark: true,
      sparkLine: spC.line,
      sparkArea: spC.area,
      sparkColor: 'rgb(174,134,232)',
      sparkFill: 'rgba(174,134,232,0.14)',
      sparkPts: spC.pts,
      sparkIsCost: true,
    },
    a.projection
      ? {
          label: 'Projected bill · this cycle',
          value: fmtMoney0(a.projection.projected),
          unit: '',
          sub: `Day ${a.projection.dayN} of ${a.projection.cycleDays} · on pace`,
          spark: false,
        }
      : {
          label: 'Projected bill · this cycle',
          value: '—',
          unit: '',
          sub: 'Set your billing cycle in setup',
          spark: false,
        },
    elec
      ? a.alwaysOn
        ? {
            label: 'Always-on load',
            value: a.alwaysOn.kwhPerHr.toFixed(2),
            unit: 'kWh/hr',
            sub: `≈ ${fmtMoney0(a.alwaysOn.monthlyCost)}/mo of standby`,
            spark: false,
          }
        : {
            label: 'Biggest day',
            value: fmtNum(Math.max(...usage), 0),
            unit: a.unit,
            sub: 'Hourly exports unlock always-on load',
            spark: false,
          }
      : {
          label: 'Active gas days',
          value: String(a.activeGas?.days ?? 0),
          unit: `of ${a.activeGas?.of ?? a.days}`,
          sub: `≈ ${(a.activeGas?.avgWhenOn ?? 0).toFixed(2)} therms when on`,
          spark: false,
        },
  ]

  const mini = seriesPath(usage, 720, 150, 4)
  const metricLabel =
    hearth.metric === 'usage' ? (elec ? 'usage (kWh)' : 'usage (therms)') : 'cost ($)'
  const events = a.events
  const highCount = events.filter((e) => e.sev === 'high').length
  const questions = bundle.questions
  const answered = questions.filter((q) => hearth.answers[`${hearth.fuel}:${q.id}`]?.length).length
  const qProg = `${answered} of ${questions.length}`
  const qProgW = questions.length ? Math.round((answered / questions.length) * 100) + '%' : '0%'

  const uploadRows = (['electric', 'gas'] as Fuel[])
    .map((f) => ({ f, b: hearth.bundles[f] }))
    .filter((x) => x.b)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        {kpis.map((k, ki) => (
          <div
            key={k.label}
            className="h-fade-up"
            style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, animationDelay: `${ki * 60}ms` }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
              {k.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.025em', lineHeight: 1 }}>
              {k.value}
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-3)', marginLeft: 5 }}>{k.unit}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{k.sub}</div>
            {k.spark && k.sparkPts && (
              <HoverChart
                key={`sp-${hearth.fuel}-${k.label}`}
                count={k.sparkPts.length}
                xAt={(i) => k.sparkPts![i][0] / 120}
                label={`${k.label}, last ${k.sparkPts.length} days`}
                tipTop={-8}
                tip={(i) => {
                  const d = a.daily.slice(-14)[i]
                  return {
                    title: fmtMonthDay(d.d),
                    rows: [
                      {
                        value: k.sparkIsCost ? fmtMoney(d.cost) : `${fmtNum(d.usage, 1)} ${a.unit}`,
                        label: k.sparkIsCost ? 'cost' : 'usage',
                        color: k.sparkColor,
                      },
                    ],
                  }
                }}
              >
                {(hover) => (
                  <svg viewBox="0 0 120 32" style={{ width: '100%', height: 32, display: 'block' }} preserveAspectRatio="none">
                    <path className="h-area" d={k.sparkArea} fill={k.sparkFill} />
                    <path className="h-draw" pathLength={1} d={k.sparkLine} fill="none" stroke={k.sparkColor} strokeWidth="1.5" />
                    {hover !== null && (
                      <circle
                        cx={k.sparkPts![hover][0]}
                        cy={k.sparkPts![hover][1]}
                        r="2.5"
                        fill={k.sparkColor}
                        stroke="var(--bg-2)"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>
                )}
              </HoverChart>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Savings at a glance</div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
              {bundle.savings.items.length ? `if you act on all ${bundle.savings.items.length === 3 ? 'three' : bundle.savings.items.length}` : 'estimates'}
            </div>
          </div>
          {bundle.savings.items.length ? (
            <>
              <div style={{ fontSize: 34, fontWeight: 700, color: 'var(--accent-green)', letterSpacing: '-0.025em', lineHeight: 1 }}>
                {bundle.savings.total}
                <span style={{ fontSize: 14, color: 'var(--fg-3)', fontWeight: 500 }}> /yr</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bundle.savings.items.map((s, si) => (
                  <div
                    key={s.label}
                    tabIndex={0}
                    aria-label={`${s.label}: ${s.amt} per year`}
                    onPointerEnter={() => setSave(si)}
                    onPointerLeave={() => setSave(null)}
                    onFocus={() => setSave(si)}
                    onBlur={() => setSave(null)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 5, outline: 'none', cursor: 'default' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                      <span style={{ color: save === si ? 'var(--fg-0)' : 'var(--fg-1)', fontWeight: 500, transition: 'color 150ms ease' }}>
                        {s.label}
                      </span>
                      <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{s.amt}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 100, background: 'var(--bg-4)', overflow: 'hidden' }}>
                      <div
                        className="h-meter"
                        style={{
                          height: '100%',
                          borderRadius: 100,
                          background: 'var(--accent-green)',
                          opacity: save === null || save === si ? 0.95 : 0.55,
                          width: mounted ? s.w : '0%',
                          transitionDelay: `${si * 90}ms`,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-4)', lineHeight: 1.45, maxHeight: save === si ? 40 : 0, opacity: save === si ? 1 : 0, overflow: 'hidden', transition: 'max-height 200ms ease, opacity 150ms ease' }}>
                      {s.note}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.5 }}>
              Upload hourly electricity data to unlock dollar-quantified savings: peak shifting,
              pre-cooling and standby trimming are all measured from your own meter.
            </div>
          )}
        </div>

        <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Insights</div>
          {bundle.insights.map((ins) => (
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
        <HoverChart
          key={`ov-${hearth.fuel}-${hearth.metric}`}
          count={a.daily.length}
          xAt={(i) => mini.pts[i][0] / 720}
          label={`Daily ${metricLabel}. Use arrow keys to step through days.`}
          tip={(i) => {
            const d = a.daily[i]
            return {
              title: fmtMonthDay(d.d),
              rows: [
                { value: `${fmtNum(d.usage, 1)} ${a.unit}`, label: 'usage', color: acc },
                { value: fmtMoney(d.cost), label: 'cost', color: 'rgb(174,134,232)' },
              ],
            }
          }}
        >
          {(hover) => (
            <svg viewBox="0 0 720 150" style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
              <path className="h-area" d={mini.area} fill="var(--accSoft,rgba(255,221,85,.13))" />
              <path className="h-draw" pathLength={1} d={mini.line} fill="none" stroke="var(--acc,#ffdd55)" strokeWidth="1.75" />
              {hover !== null && (
                <>
                  <line x1={mini.pts[hover][0]} y1={4} x2={mini.pts[hover][0]} y2={146} stroke="var(--fg-5)" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx={mini.pts[hover][0]} cy={mini.pts[hover][1]} r="4" fill="var(--acc,#ffdd55)" stroke="var(--bg-2)" strokeWidth="2" />
                </>
              )}
            </svg>
          )}
        </HoverChart>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)' }}>
          <span>{fmtMonthDay(a.periodStart).toUpperCase()}</span>
          <span>{fmtMonthDay(a.daily[Math.floor(a.daily.length / 2)].d).toUpperCase()}</span>
          <span>{fmtMonthDay(a.periodEnd).toUpperCase()}</span>
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
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: 'var(--fg-4)' }}>{plan.todayLine}</span>
          </div>
          {plan.hasAC ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 110, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>{plan.preCool.time.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-blue)', marginTop: 4 }}>{plan.preCool.temp}</div>
              </div>
              <div style={{ flex: 1, minWidth: 110, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>{plan.peak.label.toUpperCase()}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-0)', marginTop: 4 }}>{plan.peak.temp}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5 }}>
              No AC configured, so the playbook focuses on night flush and passive-cooling habits instead.
            </div>
          )}
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
            {events.length
              ? `${events.length} event${events.length === 1 ? '' : 's'} flagged this period${highCount ? `; ${highCount === 1 ? 'one high-severity spike is' : highCount + ' high-severity spikes are'} worth a look.` : '.'}`
              : 'No anomalies flagged this period. A quiet stretch.'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 100, background: 'var(--bg-4)', overflow: 'hidden' }}>
              <div className="h-meter" style={{ height: '100%', background: 'var(--acc,#ffdd55)', width: mounted ? qProgW : '0%', borderRadius: 100 }} />
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
            {hearth.mode === 'demo' ? 'Sample files · demo mode' : 'Newest upload per fuel is analyzed'}
          </div>
        </div>
        {uploadRows.map(({ f, b }) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', flexWrap: 'wrap' }}>
            <i className={FUEL_ICON[f].icon} style={{ fontSize: 17, color: FUEL_ICON[f].color, flex: 'none' }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {b!.fileName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>{b!.rangeNote}</div>
            </div>
            {f === hearth.fuel && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--acc,#ffdd55)', background: 'var(--accSoft,rgba(255,221,85,.13))', borderRadius: 100, padding: '3px 9px', flex: 'none' }}>
                viewing
              </span>
            )}
            <div style={{ fontSize: 12, color: 'var(--fg-3)', flex: 'none' }}>{b!.totalNote}</div>
            {hearth.mode === 'live' && (
              <button
                onClick={() => void store.removeMyUpload(f)}
                title="Remove this upload"
                className="h-interactive hov-fg2"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 11, color: 'var(--fg-4)', padding: 0, textDecoration: 'underline', flex: 'none' }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {hearth.mode === 'live' && (
          <button
            onClick={() => hearth.openOb(2)}
            className="h-interactive hov-bright"
            style={{ alignSelf: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 600, color: 'var(--acc,#ffdd55)', padding: 0 }}
          >
            Upload another CSV →
          </button>
        )}
      </div>

      {events.length > 0 && a.events[0] && hearth.mode === 'demo' && (
        <div style={{ fontSize: 11, color: 'var(--fg-5)', textAlign: 'center' }}>
          Demo home · sample data from {fmtDayShort(a.periodStart)} to {fmtDayShort(a.periodEnd)} · sign
          up and upload your own Green Button CSV to see your real numbers
        </div>
      )}
    </>
  )
}
