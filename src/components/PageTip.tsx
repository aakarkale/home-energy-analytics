import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { Page } from '../types'
import { NAV_PAGES } from '../model'

// A one-line brief that pops out beside a nav tab the first time someone lands
// on that page. It is for people meeting the app, not people who know it:
//
//   - visitors (the demo, or a guest's own upload) get each tip once per browser;
//   - accounts get them while the account is new, so a fresh sign-up sees the
//     tour and someone who has used Hearth for months is left alone.
//
// A tip counts as seen when it appears, not when it is dismissed, so a refresh
// never replays it.

/** How long an account counts as new. */
const NEW_ACCOUNT_DAYS = 14
/** Lets the page settle first, and skips pages the user clicks straight past. */
const SHOW_DELAY_MS = 350
/** Long enough to read one line twice. Hovering or focusing the tip holds it. */
const SHOW_MS = 7000
/** Matches the .h-pagetip-out animation. */
const EXIT_MS = 150
/** Space between the tab and the tip's arrow. */
const GAP = 12
/** Closest the tip may sit to the edge of the window. */
const EDGE = 12

const BRIEF = new Map<Page, string>(NAV_PAGES.map((n) => [n.id, n.brief]))

/** Whose tour this is, as a storage bucket name, or null when tips are off. */
export function tipAudience(
  user: { id: string; created_at?: string } | null | undefined,
): string | null {
  if (!user) return 'visitor'
  const created = Date.parse(user.created_at ?? '')
  if (!Number.isFinite(created)) return null
  return Date.now() - created < NEW_ACCOUNT_DAYS * 86_400_000 ? user.id : null
}

const seenKey = (audience: string) => `hearth-tips-seen:${audience}`
// Backs up storage for this page load, so a browser that refuses localStorage
// still sees each tip once per visit rather than on every tab switch.
const seenThisLoad = new Set<string>()

function readSeen(audience: string): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(seenKey(audience)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function hasSeen(audience: string, page: Page): boolean {
  return seenThisLoad.has(`${audience}:${page}`) || readSeen(audience).includes(page)
}

function markSeen(audience: string, page: Page): void {
  seenThisLoad.add(`${audience}:${page}`)
  const seen = readSeen(audience)
  if (seen.includes(page)) return
  try {
    localStorage.setItem(seenKey(audience), JSON.stringify([...seen, page]))
  } catch {
    /* private mode: seenThisLoad covers this visit */
  }
}

export function PageTip({
  page,
  audience,
  paused,
  placement,
}: {
  page: Page
  /** From tipAudience(). Null turns tips off entirely. */
  audience: string | null
  /** True while something else owns the screen, such as the setup dialog. */
  paused: boolean
  /** Beside a sidebar tab on desktop, above the bottom tab bar on a phone. */
  placement: 'right' | 'top'
}) {
  const [tip, setTip] = useState<Page | null>(null)
  const [closing, setClosing] = useState(false)
  const [hold, setHold] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; arrow: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // Arriving on a page: drop a tip that points at some other tab, then show
  // this page's own if it has not been seen. The delay runs through a timer
  // rather than straight in the effect, which also keeps StrictMode's double
  // mount from marking a page seen that never got its tip.
  useEffect(() => {
    if (!audience || paused) {
      setTip(null)
      return
    }
    setTip((t) => (t === page ? t : null))
    if (!BRIEF.has(page) || hasSeen(audience, page)) return
    const id = window.setTimeout(() => {
      markSeen(audience, page)
      setClosing(false)
      setHold(false)
      setTip(page)
    }, SHOW_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [page, audience, paused])

  // Fade out, then unmount.
  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(() => {
      setTip(null)
      setClosing(false)
    }, EXIT_MS)
    return () => window.clearTimeout(id)
  }, [closing])

  // Leave on its own after a while, unless the pointer or focus is on it.
  useEffect(() => {
    if (!tip || hold || closing) return
    const id = window.setTimeout(() => setClosing(true), SHOW_MS)
    return () => window.clearTimeout(id)
  }, [tip, hold, closing])

  // Escape, or pressing anywhere else, sends it away.
  useEffect(() => {
    if (!tip) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClosing(true)
    }
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setClosing(true)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [tip])

  // Pin it to the tab. Measured before paint, so it never flashes at the
  // corner, and again on resize, which also covers crossing the breakpoint
  // from sidebar to tab bar.
  useLayoutEffect(() => {
    if (!tip) {
      setPos(null)
      return
    }
    const place = () => {
      const el = box.current
      const anchor = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-nav-tab="${tip}"]`),
      ).find((a) => a.getClientRects().length > 0)
      if (!el || !anchor) {
        setPos(null)
        return
      }
      const r = anchor.getBoundingClientRect()
      const w = el.offsetWidth
      const h = el.offsetHeight
      if (placement === 'right') {
        const mid = r.top + r.height / 2
        const top = Math.max(EDGE, mid - h / 2)
        setPos({ left: r.right + GAP, top, arrow: mid - top })
      } else {
        const vw = document.documentElement.clientWidth
        const mid = r.left + r.width / 2
        const left = Math.min(Math.max(EDGE, mid - w / 2), vw - EDGE - w)
        // Keep the arrow clear of the rounded corners.
        setPos({ left, top: r.top - GAP - h, arrow: Math.min(Math.max(mid - left, 18), w - 18) })
      }
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [tip, placement])

  if (!tip) return null
  const right = placement === 'right'

  // The arrow is a rotated 10px square. Its offsets count from inside the
  // tip's 1px border, hence 6 rather than 5 to centre it on pos.arrow.
  const arrow: CSSProperties = right
    ? {
        left: -6,
        top: (pos?.arrow ?? 0) - 6,
        borderLeft: '1px solid var(--bg-6)',
        borderBottom: '1px solid var(--bg-6)',
      }
    : {
        bottom: -6,
        left: (pos?.arrow ?? 0) - 6,
        borderRight: '1px solid var(--bg-6)',
        borderBottom: '1px solid var(--bg-6)',
      }

  return (
    <div
      ref={box}
      role="status"
      aria-live="polite"
      className={closing ? 'h-pagetip-out' : right ? 'h-pagetip-right' : 'h-pagetip-top'}
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
      style={{
        position: 'fixed',
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
        zIndex: 45,
        width: 'max-content',
        maxWidth: right ? 360 : 'min(320px, calc(100vw - 24px))',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 9,
        padding: '10px 8px 10px 12px',
        background: 'var(--bg-2)',
        border: '1px solid var(--bg-6)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-pop)',
        fontFamily: 'var(--font-dm-sans)',
      }}
    >
      <i
        className="ph-fill ph-lightbulb"
        aria-hidden="true"
        style={{ fontSize: 16, color: 'var(--acc,#ffdd55)', marginTop: 1, flex: 'none' }}
      />
      <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--fg-1)', minWidth: 0 }}>
        {BRIEF.get(tip)}
      </div>
      <button
        onClick={() => setClosing(true)}
        aria-label="Dismiss tip"
        className="h-interactive hov-fg0"
        style={{
          flex: 'none',
          width: 22,
          height: 22,
          marginTop: -2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: 7,
          background: 'transparent',
          color: 'var(--fg-4)',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        <i className="ph ph-x" aria-hidden="true" />
      </button>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          background: 'var(--bg-2)',
          transform: 'rotate(45deg)',
          ...arrow,
        }}
      />
    </div>
  )
}
