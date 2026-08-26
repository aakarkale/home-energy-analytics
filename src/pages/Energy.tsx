import { useState, type CSSProperties } from 'react'
import type { Hearth, Metric } from '../types'
import { seriesPath } from '../lib/svg'
import { fmt1, fmtMoney, fmtMoney0, fmtMonthDay, hourLabel } from '../lib/format'
import { SEV_COLOR } from '../model'
import { EmptyState } from '../components/EmptyState'
import { ChartTip, HoverChart, SplitBar } from '../components/chart'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
}

const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const METRIC_TABS: { id: Metric; label: string }[] = [
  { id: 'usage', label: 'Usage' },
  { id: 'cost', label: 'Cost' },
]

export function Energy({ hearth }: { hearth: Hearth }) {
  const { elec, light, acc, bundle } = hearth
  const [cell, setCell] = useState<{ ri: number; h: number } | null>(null)
  const [dow, setDow] = useState<number | null>(null)
  if (!bundle) return <EmptyState hearth={hearth} />
  const a = bundle.analysis

  const usage = a.daily.map((d) => d.usage)
  const cost = a.daily.map((d) => d.cost)
  const series = hearth.metric === 'usage' ? usage : cost

  // Time series + 7-day trailing average.
  const ts = seriesPath(series, 720, 220, 6)
  const ma = series
    .map((_, i) => (i < 6 ? null : series.slice(i - 6, i + 1).reduce((x, y) => x + y, 0) / 7))
    .filter((v): v is number => v !== null)
  const maP = ma.length >= 2 ? seriesPath(ma, 720, 220, 6, ts.mx) : null
  const tsMA = maP
    ? 'M' +
      maP.pts
        .map((q, i) => {
          const x = 6 + ((i + 6) * (720 - 12)) / (series.length - 1)
          return x.toFixed(1) + ',' + q[1].toFixed(1)
        })
        .join('L')
    : null
  const tsDots = a.events
    .map((ev) => ({ ev, i: a.daily.findIndex((d) => d.d === ev.date) }))
    .filter((x) => x.i >= 0)
    .map((x) => ({
      x: ts.pts[x.i][0].toFixed(1),
      y: ts.pts[x.i][1].toFixed(1),
      c: SEV_COLOR[x.ev.sev],
    }))

  const midDate = a.daily[Math.floor(a.daily.length / 2)].d
  // Where each day sits across the plot, as a 0..1 fraction of the viewBox.
  const tsXAt = (i: number) => ts.pts[i][0] / 720

  // Hourly-only sections.
  const hourly = a.granularity === 'hourly' && a.hourlyProfile
  let lcBand = ''
  let lcMean = ''
  let lcPeakX = '0'
  let lcPeakW = '0'
  let lcMx = 1
  // Same geometry seriesPath uses, exposed so the hover layer can place its
  // crosshair and focus dot on the mean line.
  const lcX = (h: number) => 8 + (h * (360 - 16)) / 23
  const lcY = (v: number) => 170 - 8 - (v / lcMx) * (170 - 16)
  if (hourly) {
    const hi = seriesPath(a.hourlyProfile!.p75, 360, 170, 8)
    lcMx = hi.mx
    const lo = seriesPath(a.hourlyProfile!.p25, 360, 170, 8, hi.mx)
    const mean = seriesPath(a.hourlyProfile!.mean, 360, 170, 8, hi.mx)
    lcBand =
      hi.line +
      'L' +
      lo.pts
        .slice()
        .reverse()
        .map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1))
        .join('L') +
      'Z'
    lcMean = mean.line
    const hx = (h: number) => 8 + (h * (360 - 16)) / 23
    const s = a.tou?.startHour ?? 16
    const e = (a.tou?.endHour ?? 20) + 1
    lcPeakX = hx(s).toFixed(1)
    lcPeakW = (hx(e) - hx(s)).toFixed(1)
  }

  const ramp = [
    light ? '#ecece7' : 'rgb(23,23,23)',
    light ? '#c9d9ef' : 'rgb(21,38,62)',
    'rgb(24,74,106)',
    'rgb(31,116,96)',
    'rgb(122,160,58)',
    'rgb(217,161,59)',
    'rgb(224,100,47)',
    'rgb(210,59,59)',
  ]
  const ringColor = light ? '0 0 0 1.5px rgb(10,10,10)' : '0 0 0 1.5px rgb(245,245,245)'

  const dowLbl = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const dmx = Math.max(...a.dowAvg)
  const dowBars = a.dowAvg.map((v, i) => ({
    d: dowLbl[i],
    val: fmt1(v),
    h: Math.round((v / (dmx || 1)) * 100) + '%',
    c: i === 0 || i === 6 ? acc : 'var(--bg-5)',
  }))

  return (
    <>
      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Usage &amp; cost over time</div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 3 }}>
              Dashed line is the 7-day average · dots are flagged events
            </div>
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 100, padding: 3, gap: 2 }}>
            {METRIC_TABS.map((mt) => {
              const active = hearth.metric === mt.id
              return (
                <button
                  key={mt.id}
                  onClick={() => hearth.setMetric(mt.id)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 100,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)',
                    fontSize: 12,
                    fontWeight: 600,
                    background: active ? 'var(--bg-5)' : 'transparent',
                    color: active ? 'var(--fg-0)' : 'var(--fg-4)',
                  }}
                >
                  {mt.label}
                </button>
              )
            })}
          </div>
        </div>
        <HoverChart
          key={`ts-${hearth.fuel}-${hearth.metric}`}
          count={a.daily.length}
          xAt={tsXAt}
          label="Daily usage and cost over time. Use arrow keys to step through days."
          tip={(i) => {
            const d = a.daily[i]
            const ev = a.events.find((e) => e.date === d.d)
            const maIdx = i - 6
            return {
              title: fmtMonthDay(d.d),
              rows: [
                {
                  value: hearth.metric === 'usage' ? `${fmt1(d.usage)} ${a.unit}` : fmtMoney(d.cost),
                  label: hearth.metric === 'usage' ? 'usage' : 'cost',
                  color: acc,
                },
                ...(maIdx >= 0 && ma[maIdx] !== undefined
                  ? [{
                      value: hearth.metric === 'usage' ? fmt1(ma[maIdx]) : fmtMoney(ma[maIdx]),
                      label: '7-day avg',
                      color: 'var(--fg-4)',
                      dashed: true,
                    }]
                  : []),
                ...(ev ? [{ value: ev.title, label: 'flagged' }] : []),
              ],
            }
          }}
        >
          {(hover) => (
            <svg viewBox="0 0 720 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <path className="h-area" d={ts.area} fill="var(--accSoft,rgba(255,221,85,.13))" />
              <path className="h-draw" pathLength={1} d={ts.line} fill="none" stroke="var(--acc,#ffdd55)" strokeWidth="2" />
              {tsMA && (
                <path
                  className="h-area"
                  d={tsMA}
                  fill="none"
                  stroke="var(--fg-4)"
                  strokeWidth="1.25"
                  strokeDasharray="4 4"
                />
              )}
              {tsDots.map((d, i) => (
                <circle key={i} className="h-pop" cx={d.x} cy={d.y} r="4" fill={d.c} stroke="var(--bg-2)" strokeWidth="1.5" />
              ))}
              {hover !== null && (
                <>
                  <line
                    x1={ts.pts[hover][0]}
                    y1={6}
                    x2={ts.pts[hover][0]}
                    y2={214}
                    stroke="var(--fg-5)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={ts.pts[hover][0]}
                    cy={ts.pts[hover][1]}
                    r="5"
                    fill="var(--acc,#ffdd55)"
                    stroke="var(--bg-2)"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>
          )}
        </HoverChart>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)' }}>
          <span>{fmtMonthDay(a.periodStart).toUpperCase()}</span>
          <span>{fmtMonthDay(midDate).toUpperCase()}</span>
          <span>{fmtMonthDay(a.periodEnd).toUpperCase()}</span>
        </div>
      </div>

      {hourly ? (
        <>
          {a.heat && (
            <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
                  Hourly heatmap · last {a.heat.rows.length} days
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {a.tou && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--acc,#ffdd55)', background: 'var(--accSoft,rgba(255,221,85,.13))', borderRadius: 100, padding: '3px 10px', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
                      PEAK {a.tou.label.toUpperCase()}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>Brighter = more energy</span>
                </div>
              </div>
              <div
                onPointerLeave={() => setCell(null)}
                style={{ position: 'relative', display: 'grid', gridTemplateColumns: '52px 1fr', gap: '4px 8px' }}
              >
                <div />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 2, alignItems: 'center' }}>
                  <div style={{ gridColumn: '1/2', fontSize: 10, color: 'var(--fg-5)' }}>12A</div>
                  <div style={{ gridColumn: '7/8', fontSize: 10, color: 'var(--fg-5)' }}>6A</div>
                  <div style={{ gridColumn: '13/14', fontSize: 10, color: 'var(--fg-5)' }}>12P</div>
                  <div style={{ gridColumn: '19/20', fontSize: 10, color: 'var(--fg-5)' }}>6P</div>
                </div>
                {a.heat.rows.map((row, ri) => (
                  <div key={row.d} style={{ display: 'contents' }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: cell?.ri === ri ? 'var(--fg-1)' : 'var(--fg-4)',
                        alignSelf: 'center',
                        whiteSpace: 'nowrap',
                        transition: 'color 150ms ease',
                      }}
                    >
                      {row.label}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 2 }}>
                      {row.values.map((v, h) => {
                        const t = Math.min(1, v / a.heat!.scale)
                        const c = ramp[Math.min(7, Math.floor(t * 8))]
                        const ring = a.heat!.spikeCells.has(`${row.d}#${h}`)
                        const on = cell?.ri === ri && cell?.h === h
                        // The whole column dims so the hovered hour reads across days.
                        const dim = cell !== null && cell.h !== h
                        return (
                          <div
                            key={h}
                            className={`h-cell${on ? ' h-cell-on' : ''}`}
                            tabIndex={0}
                            role="img"
                            aria-label={`${row.label} ${hourLabel(h)}: ${v.toFixed(1)} ${a.unit}`}
                            onPointerEnter={() => setCell({ ri, h })}
                            onFocus={() => setCell({ ri, h })}
                            onBlur={() => setCell(null)}
                            style={{
                              height: 15,
                              borderRadius: 3,
                              background: c,
                              boxShadow: ring ? ringColor : 'none',
                              opacity: dim ? 0.55 : 1,
                              outline: 'none',
                            }}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
                {cell && (
                  <ChartTip
                    tip={{
                      title: `${a.heat.rows[cell.ri].label} · ${hourLabel(cell.h)}`,
                      rows: [
                        {
                          value: `${a.heat.rows[cell.ri].values[cell.h].toFixed(2)} ${a.unit}`,
                          label: 'that hour',
                          color: ramp[Math.min(7, Math.floor(Math.min(1, a.heat.rows[cell.ri].values[cell.h] / a.heat.scale) * 8))],
                        },
                        ...(a.heat.spikeCells.has(`${a.heat.rows[cell.ri].d}#${cell.h}`)
                          ? [{ value: 'Flagged spike', label: 'ringed cell' }]
                          : []),
                      ],
                    }}
                    xPct={((cell.h + 0.5) / 24) * 100}
                    top={Math.max(0, cell.ri * 19 - 62)}
                  />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--fg-4)' }}>
                <span>Less</span>
                <div style={{ flex: 'none', display: 'flex', gap: 2 }}>
                  {ramp.map((c, i) => (
                    <div key={i} style={{ width: 16, height: 9, borderRadius: 2, background: c }} />
                  ))}
                </div>
                <span>More</span>
                <span style={{ marginLeft: 'auto' }}>Ring = flagged spike</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
            <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Daily load curve</div>
              <HoverChart
                key={`lc-${hearth.fuel}`}
                count={24}
                xAt={(h) => (8 + (h * (360 - 16)) / 23) / 360}
                label="Typical load curve by hour. Use arrow keys to step through hours."
                tip={(h) => ({
                  title: hourLabel(h),
                  rows: [
                    { value: `${fmt1(a.hourlyProfile!.mean[h])} ${a.unit}`, label: 'typical', color: acc },
                    {
                      value: `${fmt1(a.hourlyProfile!.p25[h])}–${fmt1(a.hourlyProfile!.p75[h])}`,
                      label: 'usual range',
                      color: 'var(--fg-5)',
                    },
                    ...(a.tou && h >= a.tou.startHour && h <= a.tou.endHour
                      ? [{ value: 'Peak window', label: a.tou.label }]
                      : []),
                  ],
                })}
              >
                {(hover) => (
                  <svg viewBox="0 0 360 170" style={{ width: '100%', height: 'auto', display: 'block' }}>
                    {a.tou && <rect className="h-area" x={lcPeakX} y="10" width={lcPeakW} height="140" fill="var(--accSoft,rgba(255,221,85,.13))" rx="6" />}
                    <path className="h-area" d={lcBand} fill="rgba(255,255,255,0.06)" />
                    <path className="h-draw" pathLength={1} d={lcMean} fill="none" stroke="var(--acc,#ffdd55)" strokeWidth="2" />
                    {hover !== null && (
                      <>
                        <line x1={lcX(hover)} y1={8} x2={lcX(hover)} y2={158} stroke="var(--fg-5)" strokeWidth="1" strokeDasharray="3 3" />
                        <circle cx={lcX(hover)} cy={lcY(a.hourlyProfile!.mean[hover])} r="5" fill="var(--acc,#ffdd55)" stroke="var(--bg-2)" strokeWidth="2" />
                      </>
                    )}
                  </svg>
                )}
              </HoverChart>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)' }}>
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                Shaded band is your typical range{a.tou ? ' · highlighted block is the peak window' : ''}.
              </div>
            </div>

            <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>By day of week</div>
              <div
                key={`dow-${hearth.fuel}`}
                onPointerLeave={() => setDow(null)}
                style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}
              >
                {dowBars.map((b, i) => {
                  const on = dow === i
                  return (
                    <div
                      key={i}
                      tabIndex={0}
                      role="img"
                      aria-label={`${DOW_FULL[i]}: ${b.val} ${a.unit} average`}
                      onPointerEnter={() => setDow(i)}
                      onFocus={() => setDow(i)}
                      onBlur={() => setDow(null)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        height: '100%',
                        justifyContent: 'flex-end',
                        outline: 'none',
                        cursor: 'default',
                      }}
                    >
                      <div style={{ fontSize: 10, color: on ? 'var(--fg-1)' : 'var(--fg-4)', transition: 'color 150ms ease' }}>{b.val}</div>
                      <div
                        className={`h-grow h-bar${on ? ' h-bar-on' : ''}`}
                        style={{
                          width: '100%',
                          borderRadius: '6px 6px 3px 3px',
                          background: b.c,
                          height: b.h,
                          opacity: dow !== null && !on ? 0.55 : 1,
                          animationDelay: `${i * 45}ms`,
                        }}
                      />
                      <div style={{ fontSize: 11, color: on ? 'var(--fg-1)' : 'var(--fg-4)', transition: 'color 150ms ease' }}>{b.d}</div>
                    </div>
                  )
                })}
                {dow !== null && (
                  <ChartTip
                    tip={{
                      title: DOW_FULL[dow],
                      rows: [
                        { value: `${fmt1(a.dowAvg[dow])} ${a.unit}`, label: 'daily average', color: dowBars[dow].c },
                        {
                          value: a.dowAvg[dow] >= dmx ? 'Busiest' : `${Math.round((a.dowAvg[dow] / dmx) * 100)}%`,
                          label: a.dowAvg[dow] >= dmx ? 'day of the week' : 'of the busiest day',
                        },
                      ],
                    }}
                    xPct={((dow + 0.5) / 7) * 100}
                    top={4}
                  />
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                {a.weekendDeltaPct > 0
                  ? `Weekends run ${a.weekendDeltaPct}% higher. Someone's home.`
                  : a.weekendDeltaPct < 0
                    ? `Weekdays run ${-a.weekendDeltaPct}% higher. Worth checking what runs while you're out.`
                    : 'Weekends and weekdays run about even.'}
              </div>
            </div>
          </div>

          {a.tou ? (
            <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Peak vs. off-peak spend</div>
                <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                  ${a.tou.peakRate.toFixed(2)} peak · ${a.tou.offRate.toFixed(2)} off-peak · {a.tou.premiumPct}% premium, read from your own bill
                </div>
              </div>
              <SplitBar
                segments={[
                  {
                    label: `Peak · ${a.tou.label}`,
                    value: fmtMoney0(a.tou.peakCost),
                    pct: Math.round(a.tou.peakCostShare * 100),
                    color: acc,
                    note: `${Math.round(a.tou.peakCostShare * 100)}% of spend`,
                  },
                  {
                    label: 'Off-peak',
                    value: fmtMoney0(a.tou.offCost),
                    pct: 100 - Math.round(a.tou.peakCostShare * 100),
                    color: 'var(--bg-5)',
                    note: `${100 - Math.round(a.tou.peakCostShare * 100)}% of spend`,
                  },
                ]}
              />
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg-3)' }}>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--acc,#ffdd55)', marginRight: 6 }} />
                  Peak {a.tou.label} · <b style={{ color: 'var(--fg-1)' }}>{fmtMoney0(a.tou.peakCost)} ({Math.round(a.tou.peakCostShare * 100)}%)</b>
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--bg-5)', marginRight: 6 }} />
                  Off-peak · <b style={{ color: 'var(--fg-1)' }}>{fmtMoney0(a.tou.offCost)} ({100 - Math.round(a.tou.peakCostShare * 100)}%)</b>
                </span>
              </div>
            </div>
          ) : (
            <div style={{ ...card, padding: 24, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
              <i className="ph ph-info" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
              Your cost column looks flat-rate: no time-of-use peak window detected, so peak-shifting advice doesn't apply to this plan.
            </div>
          )}
        </>
      ) : (
        <div style={{ ...card, padding: 24, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
          <i className="ph ph-info" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
          {elec
            ? 'This export has daily readings, so hourly views (heatmap, load curve, peak split) appear once you upload an hourly export.'
            : 'Gas exports arrive as daily readings, so hourly views (heatmap, load curve, peak split) appear for electricity only.'}
        </div>
      )}
    </>
  )
}
