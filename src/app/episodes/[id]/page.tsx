'use client'
export const dynamic = 'force-dynamic'
// src/app/episodes/[id]/page.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

type EpisodeStatus =
  | 'QUEUED' | 'SCRIPTING' | 'VOICING' | 'RENDERING'
  | 'ASSEMBLING' | 'UPLOADING' | 'PUBLISHED' | 'FAILED'

interface Episode {
  id: string
  episodeNumber: number
  title: string
  description: string
  status: EpisodeStatus
  youtubeUrl: string | null
  youtubeVideoId: string | null
  thumbnailUrl: string | null
  videoUrl: string | null
  viewCount: number
  likeCount: number
  publishedAt: string | null
  createdAt: string
  generatedAt: string | null
  generationLog: string | null
  errorMessage: string | null
}

const STEP_ORDER: EpisodeStatus[] = [
  'QUEUED', 'SCRIPTING', 'VOICING', 'RENDERING', 'ASSEMBLING', 'UPLOADING', 'PUBLISHED',
]
const STEP_LABELS: Record<EpisodeStatus, string> = {
  QUEUED:     'Queued',
  SCRIPTING:  'Writing script',
  VOICING:    'Generating voiceover',
  RENDERING:  'Rendering images',
  ASSEMBLING: 'Assembling video',
  UPLOADING:  'Uploading to YouTube',
  PUBLISHED:  'Published',
  FAILED:     'Failed',
}
const IN_PROGRESS: EpisodeStatus[] = ['QUEUED','SCRIPTING','VOICING','RENDERING','ASSEMBLING','UPLOADING']

export default function EpisodeDetailPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string
  const logRef   = useRef<HTMLDivElement>(null)

  const [episode, setEpisode]   = useState<Episode | null>(null)
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const fetchEpisode = useCallback(async () => {
    const res = await fetch(`/api/episodes/${id}`)
    if (res.status === 401) { router.push('/login'); return }
    if (res.status === 404) { router.push('/dashboard'); return }
    if (res.ok) setEpisode(await res.json())
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    fetchEpisode()
  }, [fetchEpisode])

  // Auto-poll while generating
  useEffect(() => {
    if (!episode) return
    if (!IN_PROGRESS.includes(episode.status)) return
    const t = setInterval(fetchEpisode, 5000)
    return () => clearInterval(t)
  }, [episode, fetchEpisode])

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [episode?.generationLog])

  async function handleDelete() {
    if (!confirm(`Delete Episode ${episode?.episodeNumber}? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/episodes/${id}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  async function handleRetry() {
    setRetrying(true)
    const res = await fetch(`/api/episodes/${id}/retry`, { method: 'POST' })
    if (res.ok) {
      await fetchEpisode()
    }
    setRetrying(false)
  }

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--ink)' }}>
        <div style={{ width:36, height:36, border:'2px solid var(--wire)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (!episode) return null

  const stepIndex   = STEP_ORDER.indexOf(episode.status)
  const isActive    = IN_PROGRESS.includes(episode.status)
  const isPublished = episode.status === 'PUBLISHED'
  const isFailed    = episode.status === 'FAILED'

  return (
    <div style={{ minHeight:'100vh', background:'var(--ink)', color:'var(--white)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Topbar */}
      <header style={{ display:'flex', alignItems:'center', height:58, padding:'0 28px', background:'var(--ink2)', borderBottom:'1px solid var(--wire)', gap:16, position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'1px solid var(--wire)', borderRadius:7, padding:'6px 12px', fontSize:13, color:'var(--dim)', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          ← Dashboard
        </button>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, letterSpacing:2, background:'linear-gradient(135deg,var(--accent),var(--gold))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          EP{episode.episodeNumber}
        </span>
        <span style={{ fontSize:15, fontWeight:500, color:'var(--white)', marginRight:'auto' }}>
          {episode.title}
        </span>
        <div style={{ display:'flex', gap:8 }}>
          {isFailed && (
            <button onClick={handleRetry} disabled={retrying}
              style={{ background:'var(--accent)', border:'none', borderRadius:8, padding:'7px 16px', fontSize:13, fontWeight:500, color:'#fff', cursor:'pointer', opacity: retrying ? 0.7 : 1 }}>
              {retrying ? 'Retrying…' : '↺ Retry'}
            </button>
          )}
          {episode.youtubeUrl && (
            <a href={episode.youtubeUrl} target="_blank" rel="noopener noreferrer"
              style={{ background:'#ff0000', border:'none', borderRadius:8, padding:'7px 16px', fontSize:13, fontWeight:500, color:'#fff', textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
              ▶ Watch on YouTube
            </a>
          )}
          <button onClick={handleDelete} disabled={deleting}
            style={{ background:'none', border:'1px solid var(--wire)', borderRadius:8, padding:'7px 12px', fontSize:13, color:'var(--dim)', cursor:'pointer' }}>
            {deleting ? '…' : 'Delete'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth:900, margin:'0 auto', padding:'32px 24px' }}>

        {/* Progress stepper */}
        {!isFailed && (
          <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:12, padding:'24px 28px', marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:0 }}>
              {STEP_ORDER.map((step, i) => {
                const done    = isPublished || (stepIndex > i)
                const current = !isFailed && stepIndex === i && isActive
                const future  = stepIndex < i && !isPublished
                return (
                  <div key={step} style={{ display:'flex', alignItems:'center', flex: i < STEP_ORDER.length - 1 ? 1 : 'none' }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 500, flexShrink: 0,
                        background: done ? 'var(--teal)' : current ? 'var(--accent)' : 'var(--ink3)',
                        border: `2px solid ${done ? 'var(--teal)' : current ? 'var(--accent)' : 'var(--wire)'}`,
                        animation: current ? 'pulse 1.5s infinite' : 'none',
                        color: done || current ? '#fff' : 'var(--dim)',
                      }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div style={{ fontSize:10, color: done ? 'var(--teal)' : current ? 'var(--white)' : 'var(--dim)', textAlign:'center', lineHeight:1.3, maxWidth:64 }}>
                        {STEP_LABELS[step]}
                      </div>
                    </div>
                    {i < STEP_ORDER.length - 1 && (
                      <div style={{ flex:1, height:2, background: done ? 'var(--teal)' : 'var(--wire)', margin:'0 4px', marginBottom:20, transition:'background .3s' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Failed banner */}
        {isFailed && (
          <div style={{ background:'rgba(255,92,53,.08)', border:'1px solid rgba(255,92,53,.3)', borderRadius:12, padding:'16px 20px', marginBottom:24, display:'flex', alignItems:'flex-start', gap:12 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>⚠</span>
            <div>
              <div style={{ fontWeight:500, color:'var(--accent)', marginBottom:4 }}>Generation failed</div>
              <div style={{ fontSize:13, color:'var(--mid)', fontFamily:"'DM Mono',monospace" }}>{episode.errorMessage || 'Unknown error'}</div>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
          {/* Thumbnail / video preview */}
          <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:12, overflow:'hidden', aspectRatio:'16/9', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {episode.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={episode.thumbnailUrl} alt="Episode thumbnail" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            ) : (
              <div style={{ textAlign:'center', color:'var(--dim)' }}>
                {isActive ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                    <div style={{ width:32, height:32, border:'2px solid var(--wire)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
                    <span style={{ fontSize:12 }}>Generating…</span>
                  </div>
                ) : (
                  <span style={{ fontSize:12 }}>No thumbnail</span>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:10, padding:'14px 18px' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'var(--dim)', marginBottom:4 }}>Status</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:15, fontWeight:500 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: isPublished ? 'var(--teal)' : isFailed ? 'var(--accent)' : 'var(--gold)', flexShrink:0, animation: isActive ? 'pulse 1.5s infinite' : 'none' }} />
                {STEP_LABELS[episode.status]}
              </div>
            </div>
            <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:10, padding:'14px 18px' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'var(--dim)', marginBottom:4 }}>Views</div>
              <div style={{ fontSize:22, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:1 }}>
                {episode.viewCount >= 1000 ? `${(episode.viewCount / 1000).toFixed(1)}K` : episode.viewCount}
              </div>
            </div>
            <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:10, padding:'14px 18px' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'var(--dim)', marginBottom:4 }}>Created</div>
              <div style={{ fontSize:13, color:'var(--mid)' }}>
                {new Date(episode.createdAt).toLocaleString()}
              </div>
            </div>
            {episode.publishedAt && (
              <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:10, padding:'14px 18px' }}>
                <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:.5, color:'var(--dim)', marginBottom:4 }}>Published</div>
                <div style={{ fontSize:13, color:'var(--mid)' }}>
                  {new Date(episode.publishedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {episode.description && (
          <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:12, padding:'20px 24px', marginBottom:16 }}>
            <div style={{ fontSize:12, textTransform:'uppercase', letterSpacing:.5, color:'var(--dim)', marginBottom:8 }}>YouTube Description</div>
            <p style={{ fontSize:14, color:'var(--mid)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{episode.description}</p>
          </div>
        )}

        {/* Generation log */}
        {episode.generationLog && (
          <div style={{ background:'var(--ink2)', border:'1px solid var(--wire)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--wire)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, textTransform:'uppercase', letterSpacing:.5, color:'var(--dim)' }}>Generation Log</span>
              {isActive && (
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--teal)' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--teal)', animation:'pulse 1.5s infinite', display:'inline-block' }} />
                  Live
                </span>
              )}
            </div>
            <div
              ref={logRef}
              style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:'var(--mid)', padding:'16px 20px', maxHeight:320, overflowY:'auto', lineHeight:1.8, whiteSpace:'pre-wrap', background:'var(--ink)' }}
            >
              {episode.generationLog}
              {isActive && <span style={{ animation:'pulse 1s infinite', display:'inline-block' }}>▌</span>}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
