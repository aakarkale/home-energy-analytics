import { useMemo, useState, type CSSProperties } from 'react'
import type { Hearth } from '../types'
import type { RatesAnalysis } from '../lib/rates'
import { seriesPath } from '../lib/svg'
import { fmtMoney0, fmtMonthDay, hourLabel } from '../lib/format'
import { EmptyState } from '../components/EmptyState'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
}

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--fg-4)',
}

const W = 720
const PAD = 6
const COL_W = (W - 2 * PAD) / 24
const RATE_H = 74
const BAR_H = 170

const fmtRate = (v: number | null, dp = 4) => (v === null ? '—' : '$' + v.toFixed(dp))

/** '260–320' or just '320' when the estimate has no spread. */
function span(lo: number, hi: number, f: (v: number) => string): string {
  const a = f(lo)
  const b = f(hi)
  return a === b ? a : `${a}–${b}`
}

/** Step-function path across 24 hours for a per-hour rate accessor. */
function stepPath(get: (h: number) => number | null, y: (v: number) => number): string {
  let d = ''
  for (let h = 0; h < 24; h++) {
    const v = get(h)
    if (v === null) continue
    const x0 = PAD + h * COL_W
    const x1 = x0 + COL_W
    const yy = y(v)
    d += (d ? `L${x0.toFixed(1)},${yy.toFixed(1)}` : `M${x0.toFixed(1)},${yy.toFixed(1)}`) + `L${x1.toFixed(1)},${yy.toFixed(1)}`
  }
  return d
}

export function Rates({ hearth }: { hearth: Hearth }) {
  const { light } = hearth
  const eb = hearth.bundles.electric
  const [metric, setMetric] = useState<'energy' | 'spend'>('energy')
  const [showTable, setShowTable] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)

  const lav = light ? '#8a5fd8' : 'rgb(174,134,232)'
  const lavSoft = light ? 'rgba(138,95,216,0.10)' : 'rgba(174,134,232,0.12)'
  const lavDim = light ? 'rgba(138,95,216,0.55)' : 'rgba(174,134,232,0.55)'

  const r: RatesAnalysis | null = eb?.rates ?? null
  const tou = eb?.analysis.tou

  const derived = useMemo(() => {
    if (!r) return null
    const rateVals = r.hours.flatMap((x) => [x.below, x.above, x.effective]).filter((v): v is number => v !== null)
    const rLo = Math.min(...rateVals)
    const rHi = Math.max(...rateVals)
    const ry = (v: number) => {
      const spread = rHi - rLo || 1
      return 18 + (1 - (v - rLo) / spread) * (RATE_H - 30)
    }
    const belowPath = stepPath((h) => r.hours[h].below, ry)
    const abovePath = r.hasTiers ? stepPath((h) => r.hours[h].above, ry) : ''
    const maxVal = Math.max(...r.hours.map((x) => (metric === 'energy' ? x.avgKwh : x.totalCost))) || 1
    const focus = hovered ?? tou?.startHour ?? r.topSpendHours[0] ?? 18
    return { rLo, rHi, ry, belowPath, abovePath, maxVal, focus }
  }, [r, metric, hovered, tou])

  if (!eb) return <EmptyState hearth={hearth} />
  if (!r || !derived) {
    return (
      <div style={{ ...card, padding: 24, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
        <i className="ph ph-info" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
        Rates are read from the cost column of an hourly electricity export — upload one and this page
        fills in with your plan's price levels, hour-by-hour effective rates and baseline allowance.
      </div>
    )
  }

  const a = eb.analysis
  const offLabel = tou ? `outside ${tou.label}` : 'all hours'
  const focusRow = r.hours[derived.focus]
  const al = r.allowance

  const heaviestInPeak =
    tou && r.heaviestHours.slice(0, 2).every((h) => h >= tou.startHour && h <= tou.endHour)
  const [h1, h2] = r.topSpendHours
  const topTwoCost = r.hours[h1].totalCost + r.hours[h2].totalCost

  // Allowance chart geometry.
  let alChart: {
    line: string
    bandY: number
    bandH: number
    dotX: number
    dotY: number
    days: number
    crossDay: number
  } | null = null
  if (al && al.cumulative.length >= 2) {
    const cum = al.cumulative.map((c) => c.kwh)
    const maxY = Math.max(cum[cum.length - 1], al.perCycleHigh) * 1.08
    const p = seriesPath(cum, W, 180, 8, maxY)
    const yOf = (v: number) => 180 - 8 - (v / maxY) * (180 - 16)
    const cross = al.crossings[al.crossings.length - 1]
    const idx = Math.min(cum.length - 1, Math.max(0, cross.onDay - 1))
    alChart = {
      line: p.line,
      bandY: yOf(al.perCycleHigh),
      bandH: Math.max(3, yOf(al.perCycleLow) - yOf(al.perCycleHigh)),
      dotX: p.pts[idx][0],
      dotY: p.pts[idx][1],
      days: al.cumulative.length,
      crossDay: cross.onDay,
    }
  }

  return (
    <>
      {/* ---- Price levels ---- */}
      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
            Your price has {r.hasTiers ? 'four' : 'two'} levels
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
            Effective prices from your own bill — all charges included, so they won't match a published tariff line item
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(96px,auto) 1fr 1fr', gap: '10px 14px', alignItems: 'baseline' }}>
          <div />
          <div style={eyebrow}>Off-peak · {offLabel}</div>
          <div style={{ ...eyebrow, color: 'var(--acc,#ffdd55)' }}>Peak · {tou?.label ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{r.hasTiers ? 'Below allowance' : 'Typical'}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {fmtRate(r.offBelow)}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {fmtRate(r.peakBelow)}
          </div>
          {r.hasTiers && (
            <>
              <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>Above allowance</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {fmtRate(r.offAbove)}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                {fmtRate(r.peakAbove)}
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.premiumBelow !== null && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 100, padding: '4px 11px' }}>
              Peak premium ≈ ${(r.premiumAbove ?? r.premiumBelow).toFixed(3)}/kWh
              {r.hasTiers ? ' in either tier — timing and volume are separate levers' : ''}
            </span>
          )}
          {r.hasTiers && r.tierStepOffPct !== null && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 100, padding: '4px 11px' }}>
              Tier step +{r.tierStepOffPct}% off-peak · +{r.tierStepPeakPct ?? '—'}% peak — volume matters slightly more than timing
            </span>
          )}
        </div>
      </div>

      {/* ---- Hour by hour ---- */}
      <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Hour by hour</div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 3 }}>
              The rate you pay and the load you run, on the same clock — over {r.daysSpanned} days
            </div>
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 100, padding: 3, gap: 2 }}>
            {(['energy', 'spend'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 100,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                  fontSize: 12,
                  fontWeight: 600,
                  background: metric === m ? 'var(--bg-5)' : 'transparent',
                  color: metric === m ? 'var(--fg-0)' : 'var(--fg-4)',
                }}
              >
                {m === 'energy' ? 'Energy' : 'Spend'}
              </button>
            ))}
          </div>
        </div>

        {/* Rate strip — its own panel, never a second axis on the columns. */}
        <svg viewBox={`0 0 ${W} ${RATE_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {tou && (
            <rect
              x={PAD + tou.startHour * COL_W}
              y={2}
              width={(tou.endHour - tou.startHour + 1) * COL_W}
              height={RATE_H - 4}
              fill="var(--accSoft,rgba(255,221,85,.13))"
              rx="4"
            />
          )}
          {r.hasTiers && derived.abovePath && (
            <path d={derived.abovePath} fill="none" stroke={lav} strokeWidth="2" />
          )}
          <path d={derived.belowPath} fill="none" stroke={r.hasTiers ? lavDim : lav} strokeWidth="2" />
          {hovered !== null && (
            <line x1={PAD + (hovered + 0.5) * COL_W} y1={0} x2={PAD + (hovered + 0.5) * COL_W} y2={RATE_H} stroke="var(--fg-5)" strokeWidth="1" strokeDasharray="3 3" />
          )}
          <text x={PAD + 4} y={derived.ry(r.hours[2].above ?? r.hours[2].below ?? derived.rHi) - 5} fontSize="10" fill="var(--fg-3)" fontFamily="var(--font-dm-sans)">
            {r.hasTiers ? `above ${fmtRate(r.offAbove, 3)}` : `rate ${fmtRate(r.offBelow, 3)}`}
          </text>
          {r.hasTiers && (
            <text x={PAD + 4} y={derived.ry(r.hours[2].below ?? derived.rLo) - 5} fontSize="10" fill="var(--fg-4)" fontFamily="var(--font-dm-sans)">
              below {fmtRate(r.offBelow, 3)}
            </text>
          )}
          {tou && (
            <text
              x={PAD + (tou.startHour + (tou.endHour - tou.startHour + 1) / 2) * COL_W}
              y={Math.max(12, derived.ry(r.hours[tou.startHour].above ?? r.hours[tou.startHour].below ?? derived.rHi) - 6)}
              fontSize="10"
              fill="var(--fg-2)"
              fontFamily="var(--font-dm-sans)"
              textAnchor="middle"
            >
              peak {fmtRate(r.peakAbove ?? r.peakBelow, 3)}
            </text>
          )}
        </svg>

        {/* Usage / spend columns. */}
        <svg
          viewBox={`0 0 ${W} ${BAR_H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHovered(null)}
        >
          {tou && (
            <rect
              x={PAD + tou.startHour * COL_W}
              y={4}
              width={(tou.endHour - tou.startHour + 1) * COL_W}
              height={BAR_H - 24}
              fill="var(--accSoft,rgba(255,221,85,.13))"
              rx="4"
            />
          )}
          {r.hours.map((row) => {
            const v = metric === 'energy' ? row.avgKwh : row.totalCost
            const h = Math.max(2, (v / derived.maxVal) * (BAR_H - 40))
            const x = PAD + row.h * COL_W + 1
            const y = BAR_H - 20 - h
            const dim = hovered !== null && hovered !== row.h
            return (
              <rect
                key={row.h}
                x={x}
                y={y}
                width={COL_W - 2}
                height={h}
                rx="3"
                fill={row.peak ? 'var(--acc,#ffdd55)' : 'var(--bg-5)'}
                opacity={dim ? 0.45 : 1}
              />
            )
          })}
          {/* Selective direct labels on the two biggest marks. */}
          {[r.topSpendHours[0], r.topSpendHours[1]].map((hh) => {
            const row = r.hours[hh]
            const v = metric === 'energy' ? row.avgKwh : row.totalCost
            const h = Math.max(2, (v / derived.maxVal) * (BAR_H - 40))
            return (
              <text
                key={hh}
                x={PAD + hh * COL_W + COL_W / 2}
                y={BAR_H - 24 - h}
                fontSize="10"
                fill="var(--fg-3)"
                fontFamily="var(--font-dm-sans)"
                textAnchor="middle"
              >
                {metric === 'energy' ? row.avgKwh.toFixed(1) : fmtMoney0(row.totalCost)}
              </text>
            )
          })}
          {[0, 6, 12, 18, 23].map((hh) => (
            <text
              key={hh}
              x={PAD + hh * COL_W + COL_W / 2}
              y={BAR_H - 6}
              fontSize="10"
              fill="var(--fg-5)"
              fontFamily="var(--font-dm-sans)"
              textAnchor="middle"
            >
              {hourLabel(hh)}
            </text>
          ))}
          {r.hours.map((row) => (
            <rect
              key={`hit-${row.h}`}
              x={PAD + row.h * COL_W}
              y={0}
              width={COL_W}
              height={BAR_H}
              fill="transparent"
              onMouseEnter={() => setHovered(row.h)}
              onClick={() => setHovered(row.h)}
            />
          ))}
        </svg>

        {/* Hover readout — the tooltip row for the focused hour. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            padding: '9px 12px',
            borderRadius: 10,
            background: 'var(--bg-3)',
            border: '1px solid var(--bg-6)',
            fontSize: 12,
            color: 'var(--fg-3)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <b style={{ color: 'var(--fg-0)', fontSize: 13 }}>{hourLabel(focusRow.h)}</b>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', color: focusRow.peak ? 'var(--acc,#ffdd55)' : 'var(--fg-4)', background: focusRow.peak ? 'var(--accSoft,rgba(255,221,85,.13))' : 'var(--bg-4)', borderRadius: 100, padding: '2px 8px' }}>
            {focusRow.peak ? 'PEAK' : 'OFF'}
          </span>
          {r.hasTiers ? (
            <span>
              below <b style={{ color: 'var(--fg-1)' }}>{fmtRate(focusRow.below)}</b> · above{' '}
              <b style={{ color: 'var(--fg-1)' }}>{fmtRate(focusRow.above)}</b>
            </span>
          ) : (
            <span>
              rate <b style={{ color: 'var(--fg-1)' }}>{fmtRate(focusRow.below ?? focusRow.effective)}</b>
            </span>
          )}
          <span>
            avg <b style={{ color: 'var(--fg-1)' }}>{focusRow.avgKwh.toFixed(2)} kWh</b>
          </span>
          <span>
            total <b style={{ color: 'var(--fg-1)' }}>{fmtMoney0(focusRow.totalCost)}</b>
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--fg-5)' }}>hover a column</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg-3)' }}>
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--acc,#ffdd55)', marginRight: 6 }} />
            Peak hours
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--bg-5)', marginRight: 6 }} />
            Off-peak
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 2, background: lav, marginRight: 6, verticalAlign: 'middle' }} />
            Effective rate{r.hasTiers ? ' (below / above allowance)' : ''}
          </span>
          <button
            onClick={() => setShowTable((s) => !s)}
            className="h-interactive hov-bright"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 600, color: 'var(--acc,#ffdd55)', padding: 0 }}
          >
            {showTable ? 'Hide table' : 'Show table'}
          </button>
        </div>

        {showTable && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(72px, 1fr))', gap: '6px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 480 }}>
              {['Hour', 'Window', 'Below', 'Above', 'Avg kWh', 'Total $'].map((hd) => (
                <div key={hd} style={{ ...eyebrow, fontSize: 10 }}>{hd}</div>
              ))}
              {r.hours.map((row) => (
                <div key={row.h} style={{ display: 'contents' }}>
                  <div style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{hourLabel(row.h)}</div>
                  <div style={{ color: row.peak ? 'var(--acc,#ffdd55)' : 'var(--fg-4)', fontWeight: row.peak ? 700 : 400 }}>
                    {row.peak ? 'PEAK' : 'off'}
                  </div>
                  <div style={{ color: 'var(--fg-2)' }}>{fmtRate(row.below)}</div>
                  <div style={{ color: 'var(--fg-2)' }}>{fmtRate(row.above)}</div>
                  <div style={{ color: 'var(--fg-2)' }}>{row.avgKwh.toFixed(2)}</div>
                  <div style={{ color: 'var(--fg-2)' }}>{row.totalCost.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- The argument ---- */}
      {tou && (
        <div style={{ ...card, padding: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <i className="ph-fill ph-warning-circle" style={{ fontSize: 18, color: 'rgb(255,133,115)', flex: 'none', marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)' }}>
              {heaviestInPeak
                ? 'Your heaviest hours are also your most expensive'
                : 'Where the money concentrates'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 5, lineHeight: 1.55 }}>
              {hourLabel(h1)} and {hourLabel(h2)} average {r.hours[h1].avgKwh.toFixed(2)} and{' '}
              {r.hours[h2].avgKwh.toFixed(2)} kWh — and together they cost{' '}
              <b style={{ color: 'var(--fg-0)' }}>{fmtMoney0(topTwoCost)}</b> over {r.daysSpanned} days.
              {r.cheaperNeighbor && (
                <>
                  {' '}
                  {hourLabel(r.cheaperNeighbor.cheapHour)} uses nearly as much (
                  {r.cheaperNeighbor.cheapKwh.toFixed(2)} kWh) but cost{' '}
                  {fmtMoney0(r.cheaperNeighbor.cheapCost)}, because it lands one hour before the price
                  steps up. Same consumption,{' '}
                  <b style={{ color: 'var(--fg-0)' }}>{r.cheaperNeighbor.savingPct}% cheaper</b>.
                </>
              )}
            </div>
            {r.cheaperNeighbor && (
              <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 6 }}>
                That single comparison is the whole argument for finishing heavy loads before{' '}
                {hourLabel(tou.startHour)} — see the AC Playbook's pre-cool block.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Baseline allowance ---- */}
      {r.hasTiers ? (
        al ? (
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>Baseline allowance</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: lav, background: lavSoft, borderRadius: 100, padding: '3px 9px' }}>
                ≈ {span(al.perDayLow, al.perDayHigh, (v) => v.toFixed(1))} kWh/day
              </span>
              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-4)' }}>
                Estimated from where your unit price steps up each cycle
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.55 }}>
              The first block of every billing cycle is billed at the lower tier — a fixed discount that
              resets with the cycle, not a budget. Your data shows the step happening at:
            </div>
            {al.crossings.map((c) => (
              <div key={c.cycleStart} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: 100, background: lav, flex: 'none' }} />
                <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>
                  {fmtMonthDay(c.cycleStart)} – {fmtMonthDay(c.cycleEnd)}
                </span>
                <span style={{ color: 'var(--fg-4)', flex: 1 }}>
                  crossed after ~{Math.round(c.crossedAfterKwh)} kWh
                </span>
                <span style={{ color: 'var(--fg-2)', fontWeight: 600 }}>day {c.onDay}</span>
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
              <div style={{ borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '12px 14px' }}>
                <div style={eyebrow}>Allowance / cycle</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  ~{span(al.perCycleLow, al.perCycleHigh, (v) => String(Math.round(v)))} kWh
                </div>
              </div>
              <div style={{ borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '12px 14px' }}>
                <div style={eyebrow}>Your last cycle</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(al.lastCycleKwh).toLocaleString()} kWh
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>
                  {span(al.multipleLow, al.multipleHigh, (v) => v.toFixed(1))}× the allowance
                </div>
              </div>
              <div style={{ borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '12px 14px' }}>
                <div style={eyebrow}>Worth</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  ≈ {fmtMoney0(al.cycleValue)}/cycle
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>
                  fixed — it doesn't grow by using less
                </div>
              </div>
              <div style={{ borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '12px 14px' }}>
                <div style={eyebrow}>Marginal rate</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtRate(al.marginalOff, 3)}
                  <span style={{ fontSize: 13, color: 'var(--fg-3)', fontWeight: 500 }}> off</span>{' '}
                  {fmtRate(al.marginalPeak, 3)}
                  <span style={{ fontSize: 13, color: 'var(--fg-3)', fontWeight: 500 }}> peak</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>
                  every kWh you cut comes off the top tier
                </div>
              </div>
            </div>

            {alChart && (
              <>
                <svg viewBox={`0 0 ${W} 180`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <rect x={8} y={alChart.bandY} width={W - 16} height={alChart.bandH} fill={lavSoft} rx="3" />
                  <text x={W - 12} y={alChart.bandY - 5} fontSize="10" fill={lav} fontFamily="var(--font-dm-sans)" textAnchor="end">
                    allowance ≈ {span(al.perCycleLow, al.perCycleHigh, (v) => String(Math.round(v)))} kWh
                  </text>
                  <path d={alChart.line} fill="none" stroke="var(--acc,#ffdd55)" strokeWidth="2" />
                  <circle cx={alChart.dotX} cy={alChart.dotY} r="4.5" fill={lav} stroke="var(--bg-2)" strokeWidth="1.5" />
                  <text x={Math.min(alChart.dotX + 8, W - 90)} y={alChart.dotY - 8} fontSize="10" fill="var(--fg-2)" fontFamily="var(--font-dm-sans)">
                    crossed on day {alChart.crossDay}
                  </text>
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-4)' }}>
                  <span>Day 1</span>
                  <span>cumulative kWh through the cycle</span>
                  <span>Day {alChart.days}</span>
                </div>
              </>
            )}

            <div style={{ fontSize: 12, color: 'var(--fg-4)', lineHeight: 1.5, borderTop: '1px solid var(--bg-6)', paddingTop: 10 }}>
              Cycles are inferred from your billing dates, so partial cycles at the edges of the data
              stay out of the estimate. The exact territory allowance is on page 3 of your PG&E
              statement, under Service Information.
            </div>
          </div>
        ) : (
          <div style={{ ...card, padding: 20, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
            <i className="ph ph-info" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
            A tier step shows in your prices, but no clean cycle crossing could be pinned down — set your
            billing cycle in setup and the allowance estimate appears here.
          </div>
        )
      ) : (
        <div style={{ ...card, padding: 20, display: 'flex', gap: 12, alignItems: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
          <i className="ph ph-info" style={{ fontSize: 18, color: 'var(--accent-blue)' }} />
          No tier step detected — either this plan isn't tiered, or usage stayed within the baseline
          allowance for the whole period. {a.tou ? 'The peak window above is the lever that matters.' : ''}
        </div>
      )}
    </>
  )
}
