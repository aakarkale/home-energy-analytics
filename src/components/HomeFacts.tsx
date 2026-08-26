// The home-facts fields, shared by first-run setup and Settings.
//
// Setup runs once per account; afterwards this same editor lives under
// Settings, so there is exactly one implementation of these questions and
// one place to change them.

import type { CSSProperties } from 'react'
import type { Profile } from '../types'

export interface Facts {
  zip: string
  ac: string | null
  occ: string | null
  home: string | null
  extras: Record<string, boolean>
}

export const FACT_GROUPS: {
  key: 'ac' | 'occ' | 'home' | 'extras'
  label: string
  why: string
  opts: string[]
  multi?: boolean
}[] = [
  {
    key: 'ac',
    label: 'AC type',
    why: 'Tailors the AC Playbook, or hides it if you have no AC.',
    opts: ['Central AC', 'Heat pump', 'Window / portable', 'No AC'],
  },
  {
    key: 'occ',
    label: 'Typical weekday',
    why: 'Helps read quiet days and your daytime baseline.',
    opts: ['Someone home all day', 'Away 9–5', 'Varies'],
  },
  {
    key: 'home',
    label: 'Home type',
    why: 'Sets fair benchmarks for always-on load.',
    opts: ['House', 'Townhouse', 'Apartment / condo'],
  },
  {
    key: 'extras',
    label: 'Also true for us',
    why: 'Adds targeted questions and tips for these loads.',
    opts: ['EV', 'Pool', 'Electric dryer'],
    multi: true,
  },
]

export function factsFromProfile(p: Profile): Facts {
  return {
    zip: p.zip ?? '',
    ac: p.ac_type,
    occ: p.occupancy,
    home: p.home_type,
    extras: { EV: p.has_ev, Pool: p.has_pool, 'Electric dryer': p.has_electric_dryer },
  }
}

export function profileFromFacts(f: Facts): Partial<Profile> {
  return {
    zip: f.zip.trim() || null,
    ac_type: f.ac,
    occupancy: f.occ,
    home_type: f.home,
    has_ev: !!f.extras['EV'],
    has_pool: !!f.extras['Pool'],
    has_electric_dryer: !!f.extras['Electric dryer'],
  }
}

const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--fg-4)',
}

const hint: CSSProperties = { fontSize: 11, color: 'var(--fg-4)', lineHeight: 1.4 }

export function HomeFactsFields({
  facts,
  onChange,
  acc,
  inputStyle,
}: {
  facts: Facts
  onChange: (next: Facts) => void
  acc: string
  inputStyle: CSSProperties
}) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={label}>ZIP code</div>
        <input
          placeholder="ZIP code"
          maxLength={5}
          value={facts.zip}
          onChange={(e) => onChange({ ...facts, zip: e.target.value.replace(/\D/g, '') })}
          inputMode="numeric"
          style={{ ...inputStyle, width: 140 }}
        />
        <div style={hint}>Powers the live 7-day forecast and night-flush advice in your AC Playbook.</div>
      </div>
      {FACT_GROUPS.map((g) => (
        <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={label}>{g.label}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {g.opts.map((o) => {
              const on = g.multi ? !!facts.extras[o] : facts[g.key as 'ac' | 'occ' | 'home'] === o
              return (
                <button
                  key={o}
                  onClick={() => {
                    if (g.multi) {
                      onChange({ ...facts, extras: { ...facts.extras, [o]: !facts.extras[o] } })
                      return
                    }
                    const key = g.key as 'ac' | 'occ' | 'home'
                    onChange({ ...facts, [key]: facts[key] === o ? null : o })
                  }}
                  className="h-interactive press97"
                  style={{
                    padding: '7px 13px',
                    borderRadius: 100,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-dm-sans)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: `1px solid ${on ? acc : 'var(--bg-6)'}`,
                    background: on ? acc : 'var(--bg-3)',
                    color: on ? '#0a0a0a' : 'var(--fg-2)',
                  }}
                >
                  {o}
                </button>
              )
            })}
          </div>
          <div style={hint}>{g.why}</div>
        </div>
      ))}
    </>
  )
}
