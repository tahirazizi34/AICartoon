'use client'
export const dynamic = 'force-dynamic'
// src/app/login/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab]         = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const [loginForm, setLoginForm]   = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ studioName: '', email: '', password: '' })

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/dashboard')
    } catch {
      setError('Connection failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupForm),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/dashboard')
    } catch {
      setError('Connection failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.filmTop} />
      <div className={styles.filmBottom} />

      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.wordmark}>TOONFORGE</div>
          <div className={styles.logoSub}>AI Cartoon Studio</div>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
            onClick={() => { setTab('login'); setError('') }}
          >Sign In</button>
          <button
            className={`${styles.tab} ${tab === 'signup' ? styles.tabActive : ''}`}
            onClick={() => { setTab('signup'); setError('') }}
          >Create Account</button>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className={styles.group}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email" required
                placeholder="you@studio.com"
                value={loginForm.email}
                onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className={styles.group}>
              <label className={styles.label}>Password</label>
              <input
                className={styles.input}
                type="password" required
                placeholder="••••••••••"
                value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In to Studio'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div className={styles.group}>
              <label className={styles.label}>Studio Name</label>
              <input
                className={styles.input}
                type="text" required
                placeholder="My Awesome Studio"
                value={signupForm.studioName}
                onChange={e => setSignupForm(f => ({ ...f, studioName: e.target.value }))}
              />
            </div>
            <div className={styles.group}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email" required
                placeholder="you@studio.com"
                value={signupForm.email}
                onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className={styles.group}>
              <label className={styles.label}>Password</label>
              <input
                className={styles.input}
                type="password" required minLength={8}
                placeholder="At least 8 characters"
                value={signupForm.password}
                onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <button className={styles.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Studio Account'}
            </button>
          </form>
        )}

        <div className={styles.divider}><span>or</span></div>
        <a href="/api/youtube/connect" className={styles.oauthBtn}>
          <span className={styles.ytIcon} />
          Continue with Google
        </a>
      </div>
    </div>
  )
}
