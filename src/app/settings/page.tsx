'use client'
export const dynamic = 'force-dynamic'
// src/app/settings/page.tsx
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './settings.module.css'

type Panel = 'youtube' | 'generation' | 'api-keys' | 'schedule' | 'account'

const SCHEDULE_TIMES = [
  '06:00','07:00','08:00','09:00','10:00',
  '11:00','12:00','13:00','14:00','15:00',
  '16:00','17:00','18:00','19:00','20:00',
  '21:00','22:00','23:00',
]

function SettingsInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [panel, setPanel] = useState<Panel>('youtube')
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState('')

  // Form state
  const [settings, setSettings] = useState({
    episodesPerDay: 10,
    episodeDuration: 120,
    artStyle: '2D Cartoon',
    genre: 'Comedy Adventure',
    characterNames: '',
    scheduleEnabled: true,
    scheduleSlots: '08:00,10:00,12:00,14:00,16:00,18:00,20:00,22:00',
    timezone: 'America/New_York',
    autoPublish: true,
    defaultVisibility: 'public',
    addToPlaylist: true,
    autoCaptions: false,
    emailNotifications: true,
    anthropicKey: '',
    replicateKey: '',
    elevenLabsKey: '',
  })

  const [youtube, setYoutube] = useState<{
    channelName: string; channelHandle: string; subscriberCount: number
  } | null>(null)

  useEffect(() => {
    // Show toast from OAuth callback
    const success = searchParams.get('success')
    const error   = searchParams.get('error')
    if (success === 'youtube_connected') showToast('YouTube connected!', true)
    if (error)                            showToast('YouTube connection failed', false)

    // Fetch settings
    fetchSettings()
    fetchYouTube()
  }, [])

  async function fetchSettings() {
    const res = await fetch('/api/settings')
    if (res.status === 401) { router.push('/login'); return }
    if (res.ok) {
      const data = await res.json()
      setSettings(s => ({ ...s, ...data }))
    }
  }

  async function fetchYouTube() {
    const res = await fetch('/api/youtube/status')
    if (res.ok) {
      const data = await res.json()
      if (data.connected) setYoutube(data)
    }
  }

  function showToast(msg: string, success = true) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function saveSettings(patch: Partial<typeof settings>) {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) showToast('Settings saved')
      else showToast('Save failed', false)
    } finally {
      setSaving(false)
    }
  }

  async function disconnectYouTube() {
    await fetch('/api/youtube/disconnect', { method: 'POST' })
    setYoutube(null)
    showToast('YouTube disconnected')
  }

  const activeSlots = settings.scheduleSlots.split(',').filter(Boolean)
  function toggleSlot(time: string) {
    const next = activeSlots.includes(time)
      ? activeSlots.filter(s => s !== time)
      : [...activeSlots, time].sort()
    setSettings(s => ({ ...s, scheduleSlots: next.join(',') }))
  }

  function update<K extends keyof typeof settings>(key: K, value: typeof settings[K]) {
    setSettings(s => ({ ...s, [key]: value }))
  }

  return (
    <div className={styles.shell}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <span className={styles.logo}>TOONFORGE</span>
        <nav className={styles.nav}>
          <button className={styles.navBtn} onClick={() => router.push('/dashboard')}>Episodes</button>
          <button className={`${styles.navBtn} ${styles.navActive}`}>Settings</button>
        </nav>
        <div className={styles.topRight}>
          <button className={styles.logoutBtn} onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
          }}>Sign Out</button>
        </div>
      </header>

      {toast && (
        <div className={styles.toast}>{toast}</div>
      )}

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSub}>Configure your studio, API keys, and schedule</p>
        </div>

        <div className={styles.layout}>
          {/* Sidebar nav */}
          <nav className={styles.sideNav}>
            {(['youtube','generation','api-keys','schedule','account'] as Panel[]).map(p => (
              <button
                key={p}
                className={`${styles.sideBtn} ${panel === p ? styles.sideBtnActive : ''}`}
                onClick={() => setPanel(p)}
              >
                {p === 'api-keys' ? 'API Keys' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </nav>

          {/* Panels */}
          <div className={styles.panelArea}>

            {/* ── YOUTUBE ── */}
            {panel === 'youtube' && (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>YouTube Channel</h2>
                <p className={styles.panelSub}>Connect your channel to enable auto-publishing</p>

                {youtube ? (
                  <div className={styles.ytBlock}>
                    <div className={styles.ytInfo}>
                      <div className={styles.ytLogo} />
                      <div>
                        <div className={styles.ytName}>{youtube.channelName}</div>
                        <div className={styles.ytSub}>
                          {youtube.channelHandle && `${youtube.channelHandle} · `}
                          {youtube.subscriberCount?.toLocaleString()} subscribers
                        </div>
                      </div>
                    </div>
                    <button className={styles.btnDisconnect} onClick={disconnectYouTube}>Disconnect</button>
                  </div>
                ) : (
                  <a href="/api/youtube/connect" className={styles.btnConnect}>
                    <span className={styles.ytIcon} /> Connect YouTube Channel
                  </a>
                )}

                <Row label="Auto-publish episodes" desc="Publish immediately after generation">
                  <Toggle checked={settings.autoPublish} onChange={v => update('autoPublish', v)} />
                </Row>
                <Row label="Default visibility" desc="Visibility for newly published videos">
                  <select className={styles.select}
                    value={settings.defaultVisibility}
                    onChange={e => update('defaultVisibility', e.target.value)}>
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </Row>
                <Row label="Add to playlist" desc="Auto-add published episodes to a playlist">
                  <Toggle checked={settings.addToPlaylist} onChange={v => update('addToPlaylist', v)} />
                </Row>
                <Row label="Auto-captions" desc="Request YouTube auto-generated captions">
                  <Toggle checked={settings.autoCaptions} onChange={v => update('autoCaptions', v)} />
                </Row>
                <button className={styles.btnSave} onClick={() => saveSettings({
                  autoPublish: settings.autoPublish,
                  defaultVisibility: settings.defaultVisibility,
                  addToPlaylist: settings.addToPlaylist,
                  autoCaptions: settings.autoCaptions,
                })} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            )}

            {/* ── GENERATION ── */}
            {panel === 'generation' && (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Generation</h2>
                <p className={styles.panelSub}>Control how episodes are created daily</p>
                <Row label="Episodes per day" desc="How many to auto-generate each day">
                  <input className={styles.input} type="number" min={1} max={50}
                    value={settings.episodesPerDay}
                    onChange={e => update('episodesPerDay', parseInt(e.target.value))} />
                </Row>
                <Row label="Episode duration" desc="Target length for each episode (seconds)">
                  <select className={styles.select} value={settings.episodeDuration}
                    onChange={e => update('episodeDuration', parseInt(e.target.value))}>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </Row>
                <Row label="Art style" desc="Visual style for generated frames">
                  <select className={styles.select} value={settings.artStyle}
                    onChange={e => update('artStyle', e.target.value)}>
                    {['2D Cartoon','Anime','Flat Design','Pixel Art','Watercolor'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Genre / Theme" desc="Story genre for script generation">
                  <input className={styles.input} type="text"
                    value={settings.genre}
                    onChange={e => update('genre', e.target.value)} />
                </Row>
                <Row label="Recurring characters" desc="Character names (comma-separated)">
                  <input className={styles.input} type="text"
                    placeholder="Zorro, Mango, Pixel..."
                    value={settings.characterNames}
                    onChange={e => update('characterNames', e.target.value)} />
                </Row>
                <button className={styles.btnSave} onClick={() => saveSettings({
                  episodesPerDay: settings.episodesPerDay,
                  episodeDuration: settings.episodeDuration,
                  artStyle: settings.artStyle,
                  genre: settings.genre,
                  characterNames: settings.characterNames,
                })} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            )}

            {/* ── API KEYS ── */}
            {panel === 'api-keys' && (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>API Keys</h2>
                <p className={styles.panelSub}>Keys are stored AES-256 encrypted on your server</p>
                <KeyRow label="Anthropic (Claude)" desc="For script generation — claude.ai/settings"
                  id="k-anthropic" value={settings.anthropicKey}
                  onChange={v => update('anthropicKey', v)} />
                <KeyRow label="Replicate" desc="For image generation — replicate.com/account"
                  id="k-replicate" value={settings.replicateKey}
                  onChange={v => update('replicateKey', v)} />
                <KeyRow label="ElevenLabs" desc="For voiceover — elevenlabs.io/app/profile"
                  id="k-elevenlabs" value={settings.elevenLabsKey}
                  onChange={v => update('elevenLabsKey', v)} />
                <button className={styles.btnSave} onClick={() => saveSettings({
                  anthropicKey: settings.anthropicKey,
                  replicateKey: settings.replicateKey,
                  elevenLabsKey: settings.elevenLabsKey,
                })} disabled={saving}>{saving ? 'Saving…' : 'Save Keys'}</button>
              </div>
            )}

            {/* ── SCHEDULE ── */}
            {panel === 'schedule' && (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Schedule</h2>
                <p className={styles.panelSub}>Set the daily publish slots for your pipeline</p>
                <Row label="Auto-schedule active" desc="Run the pipeline on the times below">
                  <Toggle checked={settings.scheduleEnabled} onChange={v => update('scheduleEnabled', v)} />
                </Row>
                <Row label="Timezone" desc="All times are in this timezone">
                  <select className={styles.select} value={settings.timezone}
                    onChange={e => update('timezone', e.target.value)}>
                    {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','UTC','Europe/London','Europe/Paris','Asia/Tokyo'].map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </Row>
                <div style={{ marginTop: 20 }}>
                  <div className={styles.slotLabel}>Daily publish slots — click to toggle</div>
                  <div className={styles.slotGrid}>
                    {SCHEDULE_TIMES.map(time => (
                      <button
                        key={time}
                        className={`${styles.slot} ${activeSlots.includes(time) ? styles.slotActive : ''}`}
                        onClick={() => toggleSlot(time)}
                      >{time}</button>
                    ))}
                  </div>
                  <div className={styles.slotCount}>
                    {activeSlots.length} slots selected · {activeSlots.length} episodes/day
                  </div>
                </div>
                <button className={styles.btnSave} onClick={() => saveSettings({
                  scheduleEnabled: settings.scheduleEnabled,
                  scheduleSlots: settings.scheduleSlots,
                  timezone: settings.timezone,
                })} disabled={saving}>{saving ? 'Saving…' : 'Save Schedule'}</button>
              </div>
            )}

            {/* ── ACCOUNT ── */}
            {panel === 'account' && (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Account</h2>
                <p className={styles.panelSub}>Your profile and notification settings</p>
                <Row label="Email notifications" desc="Daily generation summary email">
                  <Toggle checked={settings.emailNotifications} onChange={v => update('emailNotifications', v)} />
                </Row>
                <button className={styles.btnSave} onClick={() => saveSettings({
                  emailNotifications: settings.emailNotifications,
                })} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 0', borderBottom: '1px solid var(--wire)',
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--white)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--dim)' }}>{desc}</div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ position: 'relative', width: 44, height: 24, cursor: 'pointer', flexShrink: 0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{
        position: 'absolute', inset: 0,
        background: checked ? 'var(--accent)' : 'var(--wire)',
        borderRadius: 12, transition: '.2s',
      }}>
        <span style={{
          position: 'absolute',
          width: 18, height: 18,
          background: checked ? '#fff' : 'var(--mid)',
          borderRadius: '50%',
          top: 3,
          left: checked ? 23 : 3,
          transition: '.2s',
        }} />
      </span>
    </label>
  )
}

function KeyRow({ label, desc, id, value, onChange }: {
  label: string; desc: string; id: string;
  value: string; onChange: (v: string) => void
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--wire)' }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--white)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 10 }}>{desc}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Paste your key here"
          style={{
            flex: 1, background: 'var(--ink3)', border: '1px solid var(--wire)',
            borderRadius: 8, padding: '9px 13px', fontSize: 13,
            color: 'var(--white)', fontFamily: "'DM Mono', monospace", outline: 'none',
          }}
        />
        <button
          onClick={() => setShow(!show)}
          style={{
            background: 'none', border: '1px solid var(--wire)', borderRadius: 8,
            padding: '9px 13px', fontSize: 12, color: 'var(--dim)', cursor: 'pointer',
            fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap',
          }}
        >{show ? 'Hide' : 'Show'}</button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--ink)' }} />}>
      <SettingsInner />
    </Suspense>
  )
}
