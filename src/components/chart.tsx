// Shared chart interaction layer.
//
// Every chart in Hearth reads the same way on hover: a crosshair finds the X,
// one tooltip lists every series at that X, values lead and labels follow, and
// the hovered mark responds. Keyboard focus gets the identical readout, so the
// numbers are never hover-gated.
//
// Motion follows the Kole rules: fast, ease-out, nothing longer than a glance,
// and all of it disabled under prefers-reduced-motion (see hearth.css).

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

/** One series' entry in a tooltip. Keyed by a short stroke, never a filled box. */
export interface TipRow {
  label: string
  value: string
  /** Series colour for the key stroke. Omit for an unkeyed note row. */
  color?: string
  dashed?: boolean
}

export interface TipModel {
  title: string
  rows: TipRow[]
}

const tipStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 3,
  pointerEvents: 'none',
  minWidth: 128,
  maxWidth: 'min(240px, 100%)',
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 12,
  boxShadow: 'var(--shadow-pop)',
  padding: '9px 11px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

/**
 * The floating readout. It is measured against its positioned parent and
 * clamped inside it — a percentage clamp cannot know the tooltip's own width,
 * and on a phone an edge-of-plot tooltip would otherwise push the page sideways.
 */
export function ChartTip({ tip, xPct, top }: { tip: TipModel; xPct: number; top?: number }) {
  const el = useRef<HTMLDivElement>(null)
  const [left, setLeft] = useState<number | null>(null)
  const shape = `${xPct}|${tip.title}|${tip.rows.map((r) => r.value + r.label).join('|')}`

  useLayoutEffect(() => {
    const node = el.current
    const parent = node?.parentElement
    if (!node || !parent) return
    const cw = parent.getBoundingClientRect().width
    const tw = node.getBoundingClientRect().width
    const ideal = (xPct / 100) * cw - tw / 2
    setLeft(Math.max(0, Math.min(Math.max(0, cw - tw), ideal)))
  }, [shape, xPct])

  return (
    <div
      ref={el}
      className="h-tip"
      style={{
        ...tipStyle,
        left: left ?? 0,
        top: top ?? 4,
        // Hidden for the single measuring pass so it never flashes mispositioned.
        visibility: left === null ? 'hidden' : 'visible',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
        {tip.title}
      </div>
      {tip.rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {r.color && (
            <span
              style={{
                flex: 'none',
                width: 12,
                height: 0,
                marginBottom: 3,
                borderTop: `2px ${r.dashed ? 'dashed' : 'solid'} ${r.color}`,
              }}
            />
          )}
          {/* Values lead, labels follow: the reader has the series, wants the number. */}
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', fontVariantNumeric: 'tabular-nums' }}>
            {r.value}
          </span>
          <span style={{ fontSize: 11, color: 'var(--fg-4)', marginLeft: 'auto', textAlign: 'right' }}>{r.label}</span>
        </div>
      ))}
    </div>
  )
}

interface HoverChartProps {
  /** Number of addressable positions (data points / bars / hours). */
  count: number
  /** Fraction (0..1) across the plot where index i sits. */
  xAt: (i: number) => number
  tip: (i: number) => TipModel | null
  /** Accessible name for the keyboard-focusable plot. */
  label: string
  children: (hover: number | null) => ReactNode
  /** Tooltip offset from the top of the wrapper. */
  tipTop?: number
  style?: CSSProperties
  /** Mirrors the focused index out, for charts that drive sibling panels. */
  onHover?: (i: number | null) => void
}

/**
 * Wraps a chart in a pointer + keyboard hover layer. The child render prop gets
 * the focused index so it can draw its own crosshair, focus dot or lifted mark.
 */
export function HoverChart({ count, xAt, tip, label, children, tipTop, style, onHover }: HoverChartProps) {
  const [hover, setHoverState] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const notify = useRef(onHover)
  notify.current = onHover

  const setHover = useCallback((next: number | null | ((h: number | null) => number | null)) => {
    setHoverState((prev) => {
      const v = typeof next === 'function' ? next(prev) : next
      if (v !== prev) notify.current?.(v)
      return v
    })
  }, [])

  const pick = useCallback(
    (clientX: number) => {
      const el = box.current
      if (!el || count < 1) return
      const r = el.getBoundingClientRect()
      if (!r.width) return
      const f = (clientX - r.left) / r.width
      // Nearest position wins, so the pointer only has to be closest.
      let best = 0
      let bestD = Infinity
      for (let i = 0; i < count; i++) {
        const d = Math.abs(xAt(i) - f)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      setHover(best)
    },
    [count, xAt],
  )

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => pick(e.clientX)

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    setHover((h) => {
      const cur = h ?? 0
      if (e.key === 'Home') return 0
      if (e.key === 'End') return count - 1
      const next = cur + (e.key === 'ArrowRight' ? 1 : -1)
      return Math.min(count - 1, Math.max(0, next))
    })
  }

  const model = hover === null ? null : tip(hover)

  return (
    <div ref={box} style={{ position: 'relative', ...style }}>
      {children(hover)}
      <div
        tabIndex={0}
        role="application"
        aria-label={label}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onFocus={() => setHover((h) => h ?? Math.max(0, count - 1))}
        onBlur={() => setHover(null)}
        style={{
          position: 'absolute',
          inset: 0,
          cursor: 'crosshair',
          // Vertical scrolling still works; a horizontal drag scrubs the chart.
          touchAction: 'pan-y',
          borderRadius: 10,
        }}
      />
      {model && <ChartTip tip={model} xPct={xAt(hover!) * 100} top={tipTop} />}
    </div>
  )
}

export interface SplitSeg {
  label: string
  value: string
  pct: number
  color: string
  /** Shown under the value in the tooltip. */
  note?: string
}

/** A share bar whose segments each carry their own hover readout. */
export function SplitBar({ segments, height = 14 }: { segments: SplitSeg[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  let acc = 0
  const mids = segments.map((s) => {
    const m = acc + s.pct / 2
    acc += s.pct
    return m
  })
  const seg = hover === null ? null : segments[hover]

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', height, borderRadius: 100, overflow: 'hidden', gap: 2 }}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="h-interactive h-seg"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            aria-label={`${s.label}: ${s.value}`}
            style={{
              width: `${s.pct}%`,
              background: s.color,
              borderRadius: i === 0 ? '100px 0 0 100px' : i === segments.length - 1 ? '0 100px 100px 0' : 0,
              opacity: hover === null || hover === i ? 1 : 0.5,
              cursor: 'default',
              outline: 'none',
            }}
          />
        ))}
      </div>
      {seg && (
        <ChartTip
          tip={{ title: seg.label, rows: [{ value: seg.value, label: seg.note ?? `${Math.round(seg.pct)}%`, color: seg.color }] }}
          xPct={mids[hover!]}
          top={height + 8}
        />
      )}
    </div>
  )
}

/**
 * Fahrenheit / Celsius switch. Placed on every card that shows a temperature so
 * the unit is changeable wherever it is read, not hidden in a settings screen.
 *
 * Both units show, with the live one lit, so the pill states which unit the
 * numbers beside it are in and what the alternative is. It is still a single
 * control: one button, so a click lands anywhere on the pill (including the
 * unlit half and the padding between) and flips the unit. The accessible name
 * says both the current state and what a press will do.
 */
export function TempToggle({
  unit,
  onChange,
  /** 'md' matches the settings-row controls it sits beside; 'sm' is the compact
   *  form for card headers and menu rows. */
  size = 'sm',
}: {
  unit: 'F' | 'C'
  onChange: (u: 'F' | 'C') => void
  size?: 'sm' | 'md'
}) {
  const other = unit === 'F' ? 'C' : 'F'
  const md = size === 'md'
  // Both units stay on screen so the pill reads as a state, not a mystery
  // button. The whole pill is one control, though: a click anywhere on it
  // flips the unit, so there is no half to aim at.
  const seg = (u: 'F' | 'C'): CSSProperties => ({
    padding: md ? '6px 15px' : '3px 9px',
    borderRadius: 100,
    fontSize: md ? 12 : 11,
    fontWeight: md ? 600 : 700,
    background: u === unit ? 'var(--bg-5)' : 'transparent',
    color: u === unit ? 'var(--fg-0)' : 'var(--fg-4)',
  })
  return (
    <button
      onClick={() => onChange(other)}
      title={`Showing °${unit}. Click to switch to °${other}.`}
      aria-label={`Temperature unit: °${unit}. Switch to °${other}.`}
      className="h-interactive hov-bd press97"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flex: 'none',
        padding: md ? 3 : 2,
        borderRadius: 100,
        border: '1px solid var(--bg-6)',
        background: 'var(--bg-3)',
        cursor: 'pointer',
        fontFamily: 'var(--font-dm-sans)',
        lineHeight: 1.35,
      }}
    >
      <span className="h-interactive" style={seg('F')}>
        °F
      </span>
      <span className="h-interactive" style={seg('C')}>
        °C
      </span>
    </button>
  )
}
