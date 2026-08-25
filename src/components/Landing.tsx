// The marketing front door. Kole voice: dark, direct, sparse — one huge
// display headline, micro-chromatic accents, every pixel earning its place.
// The hero "screenshot" is not an image: it renders live from the same
// engine + sample data the demo runs on.

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { sampleUploads, SAMPLE_BILLING } from '../lib/sample'
import { analyzeFuel } from '../lib/analyze'
import { seriesPath } from '../lib/svg'
import { fmtMoney, fmtNum } from '../lib/format'

const MAXW = 1080

const section: CSSProperties = {
  maxWidth: MAXW,
  margin: '0 auto',
  padding: '0 clamp(16px, 4vw, 28px)',
}

const accBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 22px',
  borderRadius: 100,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 14,
  fontWeight: 700,
  background: 'var(--acc,#ffdd55)',
  color: '#0a0a0a',
}

const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 22px',
  borderRadius: 100,
  border: '1px solid var(--bg-6)',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 14,
  fontWeight: 600,
  background: 'transparent',
  color: 'var(--fg-1)',
}

function HeroPreview() {
  const model = useMemo(() => {
    const { electric } = sampleUploads()
    const a = analyzeFuel(electric, SAMPLE_BILLING)
    const usage = a.daily.map((d) => d.usage)
    return { a, mini: seriesPath(usage, 640, 130, 4) }
  }, [])
  const { a, mini } = model
  const peakPct = a.tou ? Math.round(a.tou.peakCostShare * 100) : 0

  const kpi = (label: string, value: string, unit: string) => (
    <div style={{ flex: 1, minWidth: 120, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.02em', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-3)', marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  )

  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--bg-6)',
        borderRadius: 20,
        boxShadow: 'var(--shadow-pop)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--bg-6)', background: 'var(--bg-1)' }}>
        {['rgb(255,69,56)', 'rgb(255,221,85)', 'rgb(4,196,10)'].map((c) => (
          <span key={c} style={{ width: 9, height: 9, borderRadius: 100, background: c, opacity: 0.85 }} />
        ))}
        <span style={{ fontSize: 11, color: 'var(--fg-4)', marginLeft: 6 }}>Hearth · the demo home, analyzed live</span>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {kpi('Total usage', fmtNum(a.totalUsage, 1), a.unit)}
          {kpi('Total cost', fmtMoney(a.totalCost), '')}
          {kpi('Always-on', a.alwaysOn ? a.alwaysOn.kwhPerHr.toFixed(2) : '—', 'kWh/hr')}
        </div>
        <svg viewBox="0 0 640 130" style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
          <path d={mini.area} fill="var(--accSoft,rgba(255,221,85,.13))" />
          <path d={mini.line} fill="none" stroke="var(--acc,#ffdd55)" strokeWidth="1.75" />
        </svg>
        {a.tou && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', height: 10, borderRadius: 100, overflow: 'hidden', gap: 2 }}>
              <div style={{ width: `${peakPct}%`, background: 'var(--acc,#ffdd55)', borderRadius: '100px 0 0 100px' }} />
              <div style={{ width: `${100 - peakPct}%`, background: 'var(--bg-5)', borderRadius: '0 100px 100px 0' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>
              {peakPct}% of cost lands in the detected {a.tou.label} peak — read from the bill itself
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface Feature {
  icon: string
  color: string
  title: string
  body: string
  visual?: ReactNode
}

function miniMatrix(): ReactNode {
  const cell = (v: string, hot?: boolean) => (
    <div style={{ background: 'var(--bg-4)', borderRadius: 8, padding: '6px 8px', fontSize: 12, fontWeight: 700, color: hot ? 'var(--acc,#ffdd55)' : 'var(--fg-2)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
      {v}
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
      {cell('$0.30')}
      {cell('$0.42', true)}
      {cell('$0.38')}
      {cell('$0.50', true)}
    </div>
  )
}

function miniEvent(): ReactNode {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-4)', borderLeft: '3px solid rgb(255,69,56)' }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.05em', color: 'rgb(255,69,56)', background: 'rgba(255,69,56,0.12)', borderRadius: 100, padding: '2px 7px' }}>SPIKE</span>
      <span style={{ fontSize: 12, color: 'var(--fg-2)', fontWeight: 600 }}>Evening spike · +$11.78</span>
    </div>
  )
}

function miniSchedule(): ReactNode {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
      {[
        ['PRE-COOL', '72°', 'rgb(41,149,255)'],
        ['PEAK', '78°', 'var(--fg-0)'],
      ].map(([l, t, c]) => (
        <div key={l} style={{ flex: 1, background: 'var(--bg-4)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.05em', color: 'var(--fg-4)' }}>{l}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{t}</div>
        </div>
      ))}
    </div>
  )
}

const FEATURES: Feature[] = [
  {
    icon: 'ph ph-chart-line-up',
    color: 'rgb(255,221,85)',
    title: 'See the shape of your usage',
    body: 'Daily trends, an hourly heatmap, your typical load curve and day-of-week patterns — every chart drawn from your own meter readings.',
  },
  {
    icon: 'ph ph-receipt',
    color: 'rgb(174,134,232)',
    title: 'Your real rates, decoded',
    body: "Peak window, peak premium and the baseline-allowance tier step, inferred from your bill's own cost column. No plan configuration, ever.",
    visual: miniMatrix(),
  },
  {
    icon: 'ph ph-pulse',
    color: 'rgb(255,133,115)',
    title: 'Spikes, caught and explained',
    body: 'Robust statistics flag the days that broke pattern — and priced what they cost you. Estimated readings never trigger false alarms.',
    visual: miniEvent(),
  },
  {
    icon: 'ph ph-snowflake',
    color: 'rgb(41,149,255)',
    title: 'An AC playbook for your peak',
    body: 'A pre-cool schedule anchored to your detected peak window, adapted to the 7-day forecast for your ZIP. Comfort bands, not an optimizer.',
    visual: miniSchedule(),
  },
  {
    icon: 'ph ph-currency-dollar',
    color: 'rgb(4,196,10)',
    title: 'Honest dollar advice',
    body: 'Savings estimates only count load that plausibly belongs to the thing being discussed — never a flat share of the bill.',
  },
  {
    icon: 'ph ph-lock',
    color: 'rgb(255,221,85)',
    title: 'Private by design',
    body: 'Parsing and analysis run in your browser. Your CSV is stored only when you finish setup on an account — and you can remove it any time.',
  },
]

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: '1',
    title: 'Download your data',
    body: 'pge.com → Energy Usage Details → Green Button · Download my data. One click, one CSV.',
  },
  {
    n: '2',
    title: 'Drop it into Hearth',
    body: "Electric and gas, hourly or daily — the parser figures it out. Confirm your billing cycle and you're done.",
  },
  {
    n: '3',
    title: 'Read your home like a pro',
    body: 'Rates, spikes, always-on load, a thermostat plan and what each change is worth per year.',
  },
]

export function Landing({ enter }: { enter: (kind: 'create' | 'signin' | 'demo') => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(56px, 8vw, 96px)', paddingBottom: 64 }}>
      {/* Nav */}
      <div style={{ ...section, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 0' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--acc,#ffdd55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0a', fontSize: 17 }}>
            <i className="ph-fill ph-lightning" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: '-0.01em' }}>Hearth</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => enter('signin')} className="h-interactive hov-bg3" style={{ ...ghostBtn, padding: '8px 14px', fontSize: 13 }}>
              Sign in
            </button>
            <button onClick={() => enter('create')} className="h-interactive btn-acc press98" style={{ ...accBtn, padding: '8px 14px', fontSize: 13 }}>
              Get started
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={section}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'clamp(28px, 4vw, 48px)', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--acc,#ffdd55)' }}>
              For homes on PG&E
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-unbounded)',
                fontWeight: 700,
                fontSize: 'clamp(34px, 5.2vw, 58px)',
                lineHeight: 1.04,
                letterSpacing: '-0.04em',
                color: 'var(--fg-0)',
              }}
            >
              Your energy bill, decoded.
            </h1>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: 'var(--fg-2)', maxWidth: 480 }}>
              Upload the CSV your utility already gives you. Hearth reads your real rates, finds the
              spikes, and prices out exactly what to change — in your browser, on your data.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => enter('create')} className="h-interactive btn-acc press98" style={accBtn}>
                Get started free
              </button>
              <button onClick={() => enter('demo')} className="h-interactive hov-bg3" style={ghostBtn}>
                Explore the demo →
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
              Free · no card · works with any PG&E rate plan
            </div>
          </div>
          <HeroPreview />
        </div>
      </div>

      {/* Features */}
      <div style={section}>
        <h2 style={{ margin: '0 0 8px', fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--fg-0)', lineHeight: 1.1 }}>
          Everything the meter knows. Finally readable.
        </h2>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--fg-3)' }}>
          Five views, one upload — each one computed from your data, none of it generic advice.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-6)', borderRadius: 16, padding: 20 }}>
              <i className={f.icon} style={{ fontSize: 22, color: f.color }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)', margin: '10px 0 6px', letterSpacing: '-0.01em' }}>
                {f.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.55 }}>{f.body}</div>
              {f.visual}
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={section}>
        <h2 style={{ margin: '0 0 28px', fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--fg-0)', lineHeight: 1.1 }}>
          Three steps, five minutes.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-6)', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--fg-5)', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)', margin: '12px 0 6px' }}>{s.title}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.55 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy band */}
      <div style={section}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--bg-6)', borderRadius: 16, padding: 'clamp(20px, 3vw, 28px)', display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accSoft,rgba(255,221,85,.13))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc,#ffdd55)', fontSize: 20, flex: 'none' }}>
            <i className="ph ph-lock" />
          </div>
          <div style={{ minWidth: 260, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>
              Your data never leaves the browser until you choose to save it
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 5, lineHeight: 1.55 }}>
              Analysis runs locally. Finishing setup on an account stores your CSV behind row-level
              security so only you can read it — and one click removes it. No account? Guest mode keeps
              everything on this device.
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div style={{ ...section, textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-unbounded)', fontWeight: 700, fontSize: 'clamp(22px, 3.4vw, 34px)', letterSpacing: '-0.03em', color: 'var(--fg-0)', lineHeight: 1.1 }}>
          Bring one month of data. Leave with a plan.
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--fg-3)' }}>
          Or poke around the demo home first — it runs the exact same analysis.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => enter('create')} className="h-interactive btn-acc press98" style={accBtn}>
            Create free account
          </button>
          <button onClick={() => enter('demo')} className="h-interactive hov-bg3" style={ghostBtn}>
            Explore the demo →
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ ...section, width: '100%' }}>
        <div style={{ borderTop: '1px solid var(--bg-6)', paddingTop: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg-4)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--fg-2)', fontWeight: 600 }}>
            <i className="ph-fill ph-lightning" style={{ color: 'var(--acc,#ffdd55)' }} /> Hearth
          </span>
          <span>Home energy analytics for Green Button exports</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
            <button onClick={() => enter('signin')} className="h-interactive hov-fg1" style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--fg-4)', padding: 0 }}>
              Sign in
            </button>
            <button onClick={() => enter('demo')} className="h-interactive hov-fg1" style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--fg-4)', padding: 0 }}>
              Demo
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
