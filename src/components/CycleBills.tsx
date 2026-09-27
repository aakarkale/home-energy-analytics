import type { CSSProperties } from 'react'
import type { BillCycle, FuelAnalysis } from '../lib/analyze'
import { dateFromKey, fmtDateNum, fmtMoney, fmtMoney0, fmtNum } from '../lib/format'
import { HoverChart } from './chart'

// What each billing cycle came to, one bar per cycle: the Overview tile beside
// the projected bill. Finished cycles are solid; the one still running is
// faded, with its projected total dashed above what it has cost so far.

/** Cycles whose bill the readings can speak to: every one that starts in the
 *  data. A cycle already running when the file begins would read low. */
export function billCycles(a: FuelAnalysis): BillCycle[] {
  return a.cycles.filter((c) => c.startsInData).slice(-6)
}

const month = (d: string) => dateFromKey(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()

/** Room for six bars' labels: $1,240 would not fit, $1.2k does. */
const short = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : fmtMoney0(v))

export function CycleBills({
  a,
  acc,
  card,
  style,
}: {
  a: FuelAnalysis
  acc: string
  card: CSSProperties
  style?: CSSProperties
}) {
  const cycles = billCycles(a)
  if (!cycles.length) return null
  const proj = a.projection
  const projected = (c: BillCycle) => (!c.endsInData && proj && proj.start === c.start ? proj.projected : null)
  const top = Math.max(1, ...cycles.map((c) => Math.max(c.cost, projected(c) ?? 0)))
  const days = (c: BillCycle) => Math.round((dateFromKey(c.end).getTime() - dateFromKey(c.start).getTime()) / 86400000) + 1

  return (
    <div
      className="h-fade-up"
      style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, ...style }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
          Bills by cycle
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--fg-4)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtDateNum(cycles[0].start)} – {fmtDateNum(cycles[cycles.length - 1].end)}
        </div>
      </div>
      <HoverChart
        key={`bills-${a.fuel}`}
        count={cycles.length}
        xAt={(i) => (i + 0.5) / cycles.length}
        label="Bills by billing cycle. Use arrow keys to step through cycles."
        tipTop={-8}
        tip={(i) => {
          const c = cycles[i]
          const p = projected(c)
          const use = { value: `${fmtNum(c.usage, a.unit === 'kWh' ? 0 : 1)} ${a.unit}`, label: `${c.days} days` }
          return {
            title: `${fmtDateNum(c.start)} – ${fmtDateNum(c.end)}`,
            rows: c.endsInData
              ? [{ value: fmtMoney(c.cost), label: 'bill', color: acc }, use]
              : [
                  { value: fmtMoney(c.cost), label: `so far, day ${c.days} of ${days(c)}`, color: acc },
                  ...(p ? [{ value: fmtMoney0(p), label: 'projected', color: acc, dashed: true }] : []),
                  use,
                ],
          }
        }}
      >
        {(hover) => (
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, height: 92 }}>
            {cycles.map((c, i) => {
              const p = projected(c)
              const running = !c.endsInData
              return (
                <div key={c.start} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: running ? 'var(--fg-3)' : 'var(--fg-1)',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {short(c.cost)}
                  </div>
                  <div style={{ flex: 1, width: '100%', maxWidth: 36, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div
                      className="h-grow"
                      style={{
                        height: `${((p ?? c.cost) / top) * 100}%`,
                        minHeight: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        animationDelay: `${120 + i * 60}ms`,
                        filter: hover === i ? 'brightness(1.18)' : undefined,
                        transition: 'filter 150ms ease',
                      }}
                    >
                      {p !== null && p > c.cost && (
                        <div style={{ flex: p - c.cost, border: `1.5px dashed ${acc}`, borderBottom: 'none', borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                      )}
                      <div
                        style={{
                          flex: Math.max(c.cost, 0.001),
                          background: acc,
                          opacity: running ? 0.5 : 1,
                          borderRadius: p !== null && p > c.cost ? 0 : '4px 4px 0 0',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: hover === i ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                    {month(c.end)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </HoverChart>
    </div>
  )
}
