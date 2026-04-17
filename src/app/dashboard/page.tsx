'use client'
export const dynamic = 'force-dynamic'
// src/app/dashboard/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'

type EpisodeStatus = 'QUEUED' | 'SCRIPTING' | 'VOICING' | 'RENDERING' | 'ASSEMBLING' | 'UPLOADING' | 'PUBLISHED' | 'FAILED'

interface Episode {
  id: string
  episodeNumber: number
  title: string
  status: EpisodeStatus
  youtubeUrl: string | null
  thumbnailUrl: string | null
  viewCount: number
  likeCount: number
  publishedAt: string | null
  createdAt: string
  errorMessage: string | null
}

const STATUS_LABELS: Record<EpisodeStatus, string> = {
  QUEUED:     'Queued',
  SCRIPTING:  'Writing script',
  VOICING:    'Voiceover',
  RENDERING:  'Rendering',
  ASSEMBLING: 'Assembling',
  UPLOADING:  'Uploading',
  PUBLISHED:  'Published',
  FAILED:     'Failed',
}

const IN_PROGRESS: EpisodeStatus[] = ['QUEUED','SCRIPTING','VOICING','RENDERING','ASSEMBLING','UPLOADING']

export default function DashboardPage() {
  const router = useRouter()
  const [episodes, setEpisodes]       = useState<Episode[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [genFeedback, setGenFeedback] = useState('')

  const fetchEpisodes = useCallback(async () => {
    try {
      const res = await fetch('/api/episodes?limit=24')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setEpisodes(data.episodes)
      setTotal(data.total)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchEpisodes()
    // Poll every 10s if any episode is in progress
    const interval = setInterval(() => {
      const hasActive = episodes.some(e => IN_PROGRESS.includes(e.status))
      if (hasActive) fetchEpisodes()
    }, 10_000)
    return () => clearInterval(interval)
  }, [fetchEpisodes, episodes])

  async function handleGenerate() {
    setGenerating(true)
    setGenFeedback('Starting generation…')
    try {
      const res = await fetch('/api/generate', { method: 'POST' })
      if (res.ok) {
        setGenFeedback('✓ Generation started!')
        setTimeout(() => { setGenFeedback(''); setGenerating(false); fetchEpisodes() }, 2500)
      } else {
        setGenFeedback('Failed to start')
        setTimeout(() => { setGenFeedback(''); setGenerating(false) }, 2500)
      }
    } catch {
      setGenFeedback('Connection error')
      setTimeout(() => { setGenFeedback(''); setGenerating(false) }, 2500)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const published   = episodes.filter(e => e.status === 'PUBLISHED')
  const inProgress  = episodes.filter(e => IN_PROGRESS.includes(e.status))
  const totalViews  = episodes.reduce((s, e) => s + e.viewCount, 0)

  return (
    <div className={styles.shell}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <span className={styles.logo}>TOONFORGE</span>
        <nav className={styles.nav}>
          <button className={`${styles.navBtn} ${styles.navActive}`}>Episodes</button>
          <button className={styles.navBtn} onClick={() => router.push('/settings')}>Settings</button>
        </nav>
        <div className={styles.topRight}>
          {inProgress.length > 0 && (
            <div className={styles.statusPill}>
              <span className={styles.dot} />
              {inProgress.length} generating
            </div>
          )}
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {/* Main */}
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Episode Library</h1>
            <p className={styles.pageSub}>
              {total} episodes total · {inProgress.length > 0 ? `${inProgress.length} generating now` : 'Pipeline idle'}
            </p>
          </div>
          <button
            className={styles.btnGen}
            onClick={handleGenerate}
            disabled={generating}
          >
            {genFeedback || (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Generate Now
              </>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Episodes</div>
            <div className={styles.statValue}>{total}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Published</div>
            <div className={styles.statValue}>{published.length}</div>
            <div className={styles.statChange}>
              {total > 0 ? Math.round((published.length / total) * 100) : 0}% rate
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total Views</div>
            <div className={styles.statValue}>
              {totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>In Queue</div>
            <div className={styles.statValue}>{inProgress.length}</div>
            <div className={styles.statChange} style={{ color: 'var(--dim)' }}>Processing</div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className={styles.loadingRow}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : (
          <div className={styles.grid}>
            {/* Active generation cards */}
            {inProgress.map(ep => (
              <div key={ep.id} className={styles.genCard} onClick={() => router.push(`/episodes/${ep.id}`)} style={{ cursor:'pointer' }}>
                <div className={styles.genRing} />
                <div className={styles.genText}>
                  EP{ep.episodeNumber} — {STATUS_LABELS[ep.status]}…
                </div>
                <div style={{ fontSize:11, color:'var(--dim)', marginTop:4 }}>Click to watch log</div>
              </div>
            ))}

            {/* Episode cards */}
            {episodes.filter(e => !IN_PROGRESS.includes(e.status)).map(ep => (
              <div
                key={ep.id}
                className={styles.epCard}
                onClick={() => router.push(`/episodes/${ep.id}`)}
              >
                <div
                  className={styles.thumb}
                  style={{
                    backgroundImage: ep.thumbnailUrl ? `url(${ep.thumbnailUrl})` : undefined,
                    background: ep.thumbnailUrl ? undefined : `hsl(${ep.episodeNumber * 37 % 360}, 30%, 12%)`,
                  }}
                >
                  <div className={styles.thumbOverlay} />
                  <span className={`${styles.badge} ${ep.status === 'PUBLISHED' ? styles.badgeLive : ep.status === 'FAILED' ? styles.badgeFailed : styles.badgeDraft}`}>
                    {STATUS_LABELS[ep.status]}
                  </span>
                  {ep.youtubeUrl && <div className={styles.playBtn} />}
                </div>
                <div className={styles.epInfo}>
                  <span className={styles.epNum}>EP{ep.episodeNumber}</span>
                  <div className={styles.epTitle}>{ep.title}</div>
                  <div className={styles.epMeta}>
                    <span>{ep.publishedAt ? new Date(ep.publishedAt).toLocaleDateString() : new Date(ep.createdAt).toLocaleDateString()}</span>
                    {ep.viewCount > 0 && (
                      <span className={styles.epViews}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                        {ep.viewCount >= 1000 ? `${(ep.viewCount / 1000).toFixed(1)}K` : ep.viewCount}
                      </span>
                    )}
                    {ep.status === 'FAILED' && (
                      <span className={styles.failedNote} title={ep.errorMessage || ''}>Error ⚠</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
