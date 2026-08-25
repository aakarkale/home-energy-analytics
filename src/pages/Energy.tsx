import { Fragment, useMemo, type CSSProperties } from 'react'
import type { Hearth, Metric } from '../types'
import { buildHeatRows, getDataset } from '../lib/data'
import { seriesPath } from '../lib/svg'
import { fmt1 } from '../model'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
}

const METRIC_TABS: { id: Metric; label: string }[] = [
  { id: 'usage', label: 'Usage' },
  { id: 'cost', label: 'Cost' },
]

export function Energy({ hearth }: { hearth: Hearth }) {
  const { elec, light, acc } = hearth
  const D = getDataset()
  const days = elec ? D.days : D.gdays
  const usage = days.map((d) => d.usage)
  const cost = days.map((d) => d.cost)
  const series = hearth.metric === 'usage' ? usage : cost

  // Time series + 7-day trailing average, x-shifted to the window's end day.
  const ts = seriesPath(series, 720, 220, 6)
  const ma = series
    .map((_, i) => (i < 6 ? null : series.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7))
    .filter((v): v is number => v !== null)
  const maP = seriesPath(ma, 720, 220, 6, ts.mx)
  const tsMA =
    'M' +
    maP.pts
      .map((q, i) => {
        const x = 6 + ((i + 6) * (720 - 12)) / (series.length - 1)
        return x.toFixed(1) + ',' + q[1].toFixed(1)
      })
      .join('L')
  const evDays = elec
    ? [
        { i: 9, c: 'rgb(255,69,56)' },
        { i: 21, c: 'rgb(255,133,115)' },
        { i: 13, c: 'rgb(174,134,232)' },
      ]
    : [{ i: 26, c: 'rgb(255,133,115)' }]
  const tsDots = evDays.map((e) => ({
    x: ts.pts[e.i][0].toFixed(1),
    y: ts.pts[e.i][1].toFixed(1),
    c: e.c,
  }))

  // Daily load curve: typical band (25th–75th-ish) around the mean profile.
  const p75 = D.prof.map((v) => v * 1.3)
  const p25 = D.prof.map((v) => v * 0.72)
  const hi = seriesPath(p75, 360, 170, 8)
  const mx = hi.mx
  const lo = seriesPath(p25, 360, 170, 8, mx)
  const mean = seriesPath(D.prof, 360, 170, 8, mx)
  const lcBand =
    hi.line +
    'L' +
    lo.pts
      .slice()
      .reverse()
      .map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1))
      .join('L') +
    'Z'
  const hx = (h: number) => 8 + (h * (360 - 16)) / 23
  const lcPeakX = hx(16).toFixed(1)
  const lcPeakW = (hx(21) - hx(16)).toFixed(1)

  // Day-of-week averages.
  const dowLbl = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const dowSum = [0, 0, 0, 0, 0, 0, 0]
  const dowN = [0, 0, 0, 0, 0, 0, 0]
  days.forEach((d) => {
    dowSum[d.dow] += d.usage
    dowN[d.dow]++
  })
  const dowAvg = dowSum.map((v, i) => v / (dowN[i] || 1))
  const dmx = Math.max(...dowAvg)
  const dowBars = dowAvg.map((v, i) => ({
    d: dowLbl[i],
    val: fmt1(v),
    h: Math.round((v / dmx) * 100) + '%',
    c: i === 0 || i === 6 ? acc : 'var(--bg-5)',
  }))
  const wkAvg = (dowAvg[0] + dowAvg[6]) / 2
  const wdAvg = dowAvg.slice(1, 6).reduce((a, b) => a + b, 0) / 5
  const weekendDelta = Math.round((wkAvg / wdAvg - 1) * 100) + '%'

  const { heatRows, ramp } = useMemo(() => buildHeatRows(light), [light])

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
        <svg viewBox="0 0 720 220" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <path d={ts.area} fill="var(--accSoft,rgba(255,221,85,.13))" />
          <path d={ts.line} fill="none" stroke="var(--acc,#ffdd55)" strokeWidth="2" />
          <path d={tsMA} fill="none" stroke="var(--fg-4)" strokeWidth="1.25" strokeDasharray="4 4" />
          {tsDots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r="4" fill={d.c} stroke="var(--bg-2)" strokeWidth="1.5" />
          ))}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)' }}>
          <span>JUL 25</span>
          <span>AUG 8</span>
          <span>AUG 23</span>
        </div>
      </div>

      {elec ? (
        <>
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Hourly heatmap · last 14 days</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--acc,#ffdd55)', background: 'var(--accSoft,rgba(255,221,85,.13))', borderRadius: 100, padding: '3px 10px', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
                  PEAK 4–9 PM
                </span>
                <span style={{ fontSize: 12, color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>Brighter = more energy</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: '4px 8px' }}>
              <div />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 2, alignItems: 'center' }}>
                <div style={{ gridColumn: '1/2', fontSize: 10, color: 'var(--fg-5)' }}>12A</div>
                <div style={{ gridColumn: '7/8', fontSize: 10, color: 'var(--fg-5)' }}>6A</div>
                <div style={{ gridColumn: '13/14', fontSize: 10, color: 'var(--fg-5)' }}>12P</div>
                <div style={{ gridColumn: '19/20', fontSize: 10, color: 'var(--fg-5)' }}>6P</div>
              </div>
              {heatRows.map((row) => (
                <Fragment key={row.label}>
                  <div style={{ fontSize: 10, color: 'var(--fg-4)', alignSelf: 'center', whiteSpace: 'nowrap' }}>{row.label}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24,1fr)', gap: 2 }}>
                    {row.cells.map((cell, i) => (
                      <div key={i} title={cell.tip} style={{ height: 15, borderRadius: 3, background: cell.c, boxShadow: cell.ring }} />
                    ))}
                  </div>
                </Fragment>
              ))}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
            <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Daily load curve</div>
              <svg viewBox="0 0 360 170" style={{ width: '100%', height: 'auto', display: 'block' }}>
                <rect x={lcPeakX} y="10" width={lcPeakW} height="140" fill="var(--accSoft,rgba(255,221,85,.13))" rx="6" />
                <path d={lcBand} fill="rgba(255,255,255,0.06)" />
                <path d={mean.line} fill="none" stroke="var(--acc,#ffdd55)" strokeWidth="2" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)' }}>
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                Shaded band is your typical range · highlighted block is the peak window.
              </div>
            </div>

            <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>By day of week</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
                {dowBars.map((b, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>{b.val}</div>
                    <div style={{ width: '100%', borderRadius: '6px 6px 3px 3px', background: b.c, height: b.h }} />
                    <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>{b.d}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Weekends run {weekendDelta} higher — someone's home.</div>
            </div>
          </div>

          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Peak vs. off-peak spend</div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                $0.52 peak · $0.39 off-peak · 32% premium — read from your own bill
              </div>
            </div>
            <div style={{ display: 'flex', height: 14, borderRadius: 100, overflow: 'hidden', gap: 2 }}>
              <div style={{ width: '31%', background: 'var(--acc,#ffdd55)', borderRadius: '100px 0 0 100px' }} />
              <div style={{ width: '69%', background: 'var(--bg-5)', borderRadius: '0 100px 100px 0' }} />
            </div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg-3)' }}>
              <span>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--acc,#ffdd55)', marginRight: 6 }} />
                Peak 4–9 PM · <b style={{ color: 'var(--fg-1)' }}>$212 (31%)</b>
              </span>
              <span>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--bg-5)', marginRight: 6 }} />
                Off-peak · <b style={{ color: 'var(--fg-1)' }}>$474 (69%)</b>
              </span>
            </div>
          </div>
        </>
      ) : (
        <div style={{ ...card, padding: 24, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
          <i className="ph ph-info" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
          Gas exports arrive as daily readings, so hourly views (heatmap, load curve, peak split) appear for electricity only.
        </div>
      )}
    </>
  )
}
