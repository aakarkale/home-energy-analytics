import type { CSSProperties } from 'react'
import type { Hearth, ObTab } from '../types'

const OB_TITLES = ['Welcome to Hearth', 'Your home', 'Your data', 'Billing cycle']

const OB_TABS: { id: ObTab; label: string }[] = [
  { id: 'create', label: 'Create account' },
  { id: 'signin', label: 'Sign in' },
]

const OB_GROUPS: { key: 'ac' | 'occ' | 'home' | 'extras'; label: string; opts: string[]; multi?: boolean }[] = [
  { key: 'ac', label: 'AC type', opts: ['Central AC', 'Heat pump', 'Window / portable', 'No AC'] },
  { key: 'occ', label: 'Typical weekday', opts: ['Someone home all day', 'Away 9–5', 'Varies'] },
  { key: 'home', label: 'Home type', opts: ['House', 'Townhouse', 'Apartment / condo'] },
  { key: 'extras', label: 'Also true for us', opts: ['EV', 'Pool', 'Electric dryer'], multi: true },
]

const inputStyle: CSSProperties = {
  background: 'var(--bg-3)',
  border: '1px solid var(--bg-6)',
  borderRadius: 12,
  padding: '11px 14px',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 14,
  color: 'var(--fg-1)',
}

const backBtn: CSSProperties = {
  padding: '11px 18px',
  borderRadius: 100,
  border: '1px solid var(--bg-6)',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 13,
  fontWeight: 600,
  background: 'transparent',
  color: 'var(--fg-2)',
}

const ctaBtn: CSSProperties = {
  padding: 11,
  borderRadius: 100,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-dm-sans)',
  fontSize: 14,
  fontWeight: 700,
  background: 'var(--acc,#ffdd55)',
  color: '#0a0a0a',
}

export function Onboarding({ hearth }: { hearth: Hearth }) {
  const { obStep, obTab, obSel, acc } = hearth
  const obCreate = obTab === 'create'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(9,9,9,0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '100%',
          overflowY: 'auto',
          background: 'var(--bg-2)',
          border: '1px solid var(--bg-6)',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: 'var(--shadow-pop)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'var(--acc,#ffdd55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0a0a0a',
              fontSize: 14,
            }}
          >
            <i className="ph-fill ph-lightning" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)' }}>{OB_TITLES[obStep]}</div>
          <button
            onClick={hearth.closeOb}
            className="h-interactive hov-fg0"
            style={{
              marginLeft: 'auto',
              width: 28,
              height: 28,
              borderRadius: 100,
              border: 'none',
              background: 'var(--bg-4)',
              color: 'var(--fg-3)',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="ph ph-x" />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{ flex: 1, height: 4, borderRadius: 100, background: i <= obStep ? 'var(--acc,#ffdd55)' : 'var(--bg-5)' }}
            />
          ))}
        </div>

        {obStep === 0 && (
          <>
            <div style={{ display: 'flex', background: 'var(--bg-3)', border: '1px solid var(--bg-6)', borderRadius: 100, padding: 3, gap: 2 }}>
              {OB_TABS.map((t) => {
                const active = obTab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => hearth.setObTab(t.id)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 100,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-dm-sans)',
                      fontSize: 13,
                      fontWeight: 600,
                      background: active ? 'var(--bg-5)' : 'transparent',
                      color: active ? 'var(--fg-0)' : 'var(--fg-4)',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {obCreate && <input placeholder="Your name" style={inputStyle} />}
              <input placeholder="Email" style={inputStyle} />
              <input placeholder="Password (8+ characters)" type="password" style={inputStyle} />
            </div>
            <button
              onClick={hearth.obNext}
              className="h-interactive btn-acc press98"
              style={{ ...ctaBtn, padding: 12 }}
            >
              {obCreate ? 'Create account' : 'Sign in'}
            </button>
            <button
              onClick={hearth.obNext}
              className="h-interactive hov-fg1"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 13, fontWeight: 600, color: 'var(--fg-3)', padding: 0 }}
            >
              Explore without an account →
            </button>
          </>
        )}

        {obStep === 1 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: -8 }}>
              A few facts sharpen every estimate. All optional.
            </div>
            <input placeholder="ZIP code" maxLength={5} style={{ ...inputStyle, width: 140 }} />
            {OB_GROUPS.map((g) => (
              <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                  {g.label}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {g.opts.map((o) => {
                    const on = g.multi ? !!obSel.extras[o] : obSel[g.key] === o
                    return (
                      <button
                        key={o}
                        onClick={() => hearth.pickObOption(g.key, o, !!g.multi)}
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
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={hearth.obBack} className="h-interactive hov-bg3" style={backBtn}>
                Back
              </button>
              <button onClick={hearth.obNext} className="h-interactive btn-acc" style={{ ...ctaBtn, flex: 1 }}>
                Continue
              </button>
            </div>
            <button
              onClick={hearth.obNext}
              className="h-interactive hov-fg2"
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: 12, color: 'var(--fg-4)', padding: 0 }}
            >
              Skip for now
            </button>
          </>
        )}

        {obStep === 2 && (
          <>
            <div
              className="h-interactive dropzone"
              style={{
                border: '1.5px dashed var(--fg-5)',
                borderRadius: 16,
                padding: '34px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <i className="ph ph-file-arrow-up" style={{ fontSize: 30, color: 'var(--fg-3)' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>Drop your PG&amp;E CSVs here</div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                or click to browse · electric and gas can arrive separately
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', lineHeight: 1.5 }}>
              Get the file from pge.com → Energy Usage Details →{' '}
              <b style={{ color: 'var(--fg-2)' }}>Green Button · Download my data</b>. Your data never leaves this device
              until you choose to save it.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={hearth.obBack} className="h-interactive hov-bg3" style={backBtn}>
                Back
              </button>
              <button onClick={hearth.obNext} className="h-interactive btn-acc" style={{ ...ctaBtn, flex: 1 }}>
                Use sample data instead
              </button>
            </div>
          </>
        )}

        {obStep === 3 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: -8 }}>
              We pre-filled this from your file — confirm and you're done.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                  Cycle starts
                </div>
                <input value="Jul 24, 2026" readOnly style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--fg-4)' }}>
                  Cycle ends
                </div>
                <input value="Aug 23, 2026" readOnly style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ borderRadius: 14, background: 'var(--bg-3)', border: '1px solid var(--bg-6)', padding: '14px 16px', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>LENGTH</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)', marginTop: 3 }}>31 days</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>COVERS</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-0)', marginTop: 3 }}>1 cycle</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '.05em' }}>PROJECTED</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-green)', marginTop: 3 }}>$214</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={hearth.obBack} className="h-interactive hov-bg3" style={backBtn}>
                Back
              </button>
              <button onClick={hearth.closeOb} className="h-interactive btn-acc" style={{ ...ctaBtn, flex: 1 }}>
                Finish setup
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
