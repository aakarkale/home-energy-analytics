// Settings: appearance, units, home facts and data management.
//
// Home facts live here rather than only in first-run setup, so setup can run
// once per account and still be corrected later.

import { useEffect, useState, type CSSProperties } from 'react'
import type { Fuel, Hearth } from '../types'
import type { HearthStore } from '../store'
import { FUEL_ICON } from '../model'
import { fmtDateNum, fmtMoney, fmtNum } from '../lib/format'
import {
  factsFromProfile,
  HomeFactsFields,
  profileFromFacts,
  type Facts,
} from '../components/HomeFacts'

const card: CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--bg-6)',
  borderRadius: 16,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const h2: CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }
const sub: CSSProperties = { fontSize: 12, color: 'var(--fg-4)', lineHeight: 1.5 }

const inputStyle: CSSProperties = {
  background: 'var(--bg-3)',
  border: '1px solid var(--bg-6)',
  borderRadius: 12,
  padding: '11px 14px',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 14,
  color: 'var(--fg-1)',
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 100, padding: 3, gap: 2, flex: 'none' }}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className="h-interactive press97"
          style={{
            padding: '6px 16px',
            borderRadius: 100,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans)',
            fontSize: 12,
            fontWeight: 600,
            background: value === o.id ? 'var(--bg-5)' : 'transparent',
            color: value === o.id ? 'var(--fg-0)' : 'var(--fg-4)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 180, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{title}</div>
        <div style={{ ...sub, marginTop: 2 }}>{note}</div>
      </div>
      {children}
    </div>
  )
}

export function Settings({ hearth, store }: { hearth: Hearth; store: HearthStore }) {
  const [facts, setFacts] = useState<Facts>(() => factsFromProfile(store.profile))
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [wipeMsg, setWipeMsg] = useState<string | null>(null)

  // Follow the profile until the user starts editing it here.
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!dirty) setFacts(factsFromProfile(store.profile))
  }, [store.profile, dirty])

  const myUploads = Object.entries(store.myUploads).filter(([, v]) => v) as [
    Fuel,
    NonNullable<(typeof store.myUploads)[Fuel]>,
  ][]

  function saveFacts() {
    store.saveProfilePatch(profileFromFacts(facts))
    setDirty(false)
    setSavedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
  }

  /** Everything this browser or account holds, as one JSON file. */
  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: store.profile,
      answers: store.answers,
      annotations: store.evMeta,
      uploads: Object.entries(store.myUploads)
        .filter(([, v]) => v)
        .map(([fuel, rec]) => ({
          fuel,
          fileName: rec!.parsed.fileName,
          billing: rec!.billing,
          csv: rec!.parsed.csv,
        })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hearth-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function removeUpload(fuel: Fuel) {
    setBusy(fuel)
    await store.removeMyUpload(fuel)
    setBusy(null)
  }

  async function wipeEverything() {
    setBusy('wipe')
    if (store.session) {
      const res = await store.deleteAllMyData()
      setWipeMsg(res.error ? `Could not delete: ${res.error}` : 'All of your data has been deleted.')
    } else {
      store.clearGuestData()
      setWipeMsg('Local data cleared from this browser.')
    }
    setBusy(null)
    setConfirmWipe(false)
  }

  return (
    <>
      <div style={card}>
        <div style={h2}>Appearance</div>
        <Row title="Theme" note="Charts, surfaces and form controls all follow this.">
          <Segmented
            value={hearth.theme}
            options={[
              { id: 'dark', label: 'Dark' },
              { id: 'light', label: 'Light' },
            ]}
            onChange={(t) => {
              if (t !== hearth.theme) hearth.toggleTheme()
            }}
          />
        </Row>
      </div>

      <div style={card}>
        <div style={h2}>Units &amp; formats</div>
        <Row title="Temperature" note="Applies to the AC Playbook and every forecast tile.">
          <Segmented
            value={hearth.tempUnit}
            options={[
              { id: 'F', label: '°F' },
              { id: 'C', label: '°C' },
            ]}
            onChange={hearth.setTempUnit}
          />
        </Row>
        <Row
          title="Dates"
          note="mm/dd/yyyy everywhere. Uploads in another order are converted on import, and you are asked when a file reads both ways."
        >
          <span style={{ fontSize: 13, color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtDateNum(new Date().toISOString().slice(0, 10))}
          </span>
        </Row>
        <Row title="Energy units" note="Read from your file: kWh for electricity, therms for gas.">
          <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>From your data</span>
        </Row>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={h2}>Your home</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {savedAt && <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>Saved {savedAt}</span>}
            <button
              onClick={saveFacts}
              disabled={!dirty}
              className="h-interactive btn-acc press98"
              style={{
                padding: '8px 18px',
                borderRadius: 100,
                border: 'none',
                cursor: dirty ? 'pointer' : 'default',
                fontFamily: 'var(--font-dm-sans)',
                fontSize: 13,
                fontWeight: 700,
                background: 'var(--acc,#ffdd55)',
                color: '#0a0a0a',
                opacity: dirty ? 1 : 0.5,
              }}
            >
              Save changes
            </button>
          </div>
        </div>
        <div style={sub}>
          These answers shape what Hearth asks and suggests. Setup asks them once when you create your
          account; change them here any time.
        </div>
        <HomeFactsFields
          facts={facts}
          onChange={(f) => {
            setDirty(true)
            setFacts(f)
          }}
          acc={hearth.acc}
          inputStyle={inputStyle}
        />
      </div>

      <div style={card}>
        <div style={h2}>Your data</div>
        <div style={sub}>
          {store.session
            ? 'Stored against your account behind row-level security, so only you can read it.'
            : 'Held in this browser only. Create an account to sync it across devices.'}
        </div>

        {myUploads.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', fontSize: 13, color: 'var(--fg-3)', flexWrap: 'wrap' }}>
            <i className="ph ph-file-dashed" style={{ fontSize: 18, color: 'var(--fg-4)' }} />
            No files yet.
            <button
              onClick={() => hearth.openOb(2)}
              className="h-interactive hov-bright"
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--acc,#ffdd55)' }}
            >
              Upload a CSV →
            </button>
          </div>
        ) : (
          myUploads.map(([fuel, rec]) => (
            <div
              key={fuel}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', flexWrap: 'wrap' }}
            >
              <i className={FUEL_ICON[fuel].icon} style={{ fontSize: 17, color: FUEL_ICON[fuel].color, flex: 'none' }} />
              <div style={{ minWidth: 160, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', wordBreak: 'break-all' }}>
                  {rec.parsed.fileName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2 }}>
                  {rec.parsed.granularity} · {rec.parsed.rowCount} rows ·{' '}
                  {fmtDateNum(rec.parsed.periodStart)} – {fmtDateNum(rec.parsed.periodEnd)}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', flex: 'none' }}>
                {fmtNum(rec.parsed.totalUsage, 1)} {rec.parsed.unit} · {fmtMoney(rec.parsed.totalCost)}
              </div>
              <button
                onClick={() => void removeUpload(fuel)}
                disabled={busy === fuel}
                className="h-interactive hov-fg0"
                style={{ border: '1px solid var(--bg-6)', background: 'transparent', borderRadius: 100, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 600, color: 'var(--fg-3)', flex: 'none' }}
              >
                {busy === fuel ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => hearth.openOb(2)}
            className="h-interactive hov-bg3"
            style={{ border: '1px solid var(--bg-6)', background: 'transparent', borderRadius: 100, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}
          >
            <i className="ph ph-upload-simple" style={{ marginRight: 7 }} />
            Upload another CSV
          </button>
          <button
            onClick={exportData}
            className="h-interactive hov-bg3"
            style={{ border: '1px solid var(--bg-6)', background: 'transparent', borderRadius: 100, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}
          >
            <i className="ph ph-download-simple" style={{ marginRight: 7 }} />
            Export my data
          </button>
        </div>
      </div>

      <div style={{ ...card, borderColor: 'rgba(255,69,56,0.35)' }}>
        <div style={{ ...h2, color: 'var(--accent-red)' }}>Danger zone</div>
        <div style={sub}>
          {store.session
            ? 'Deletes every upload, answer and annotation on your account, and clears your home facts. Your sign-in stays, so you can start fresh.'
            : 'Clears the uploads and answers this browser is holding. Nothing is stored anywhere else.'}
        </div>
        {wipeMsg && (
          <div style={{ fontSize: 12, color: wipeMsg.startsWith('Could not') ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {wipeMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {confirmWipe ? (
            <>
              <button
                onClick={() => void wipeEverything()}
                disabled={busy === 'wipe'}
                className="h-interactive press98"
                style={{ border: 'none', background: 'var(--accent-red)', color: '#fff', borderRadius: 100, padding: '9px 18px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 700 }}
              >
                {busy === 'wipe' ? 'Deleting…' : 'Yes, delete everything'}
              </button>
              <button
                onClick={() => setConfirmWipe(false)}
                className="h-interactive hov-bg3"
                style={{ border: '1px solid var(--bg-6)', background: 'transparent', borderRadius: 100, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-2)' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setWipeMsg(null)
                setConfirmWipe(true)
              }}
              className="h-interactive"
              style={{ border: '1px solid rgba(255,69,56,0.4)', background: 'transparent', borderRadius: 100, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--accent-red)' }}
            >
              <i className="ph ph-trash" style={{ marginRight: 7 }} />
              {store.session ? 'Delete all my data' : 'Clear local data'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
