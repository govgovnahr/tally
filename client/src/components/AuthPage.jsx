import { useState, useEffect } from 'react'
import { PiggyBank, Sun, Moon } from 'lucide-react'
import { supabase } from '../supabase.js'
import { useC } from '../colors'

export default function AuthPage({ mode, onToggleMode }) {
  const C = useC()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  // Password recovery (arrived via reset email link)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [newConfirm, setNewConfirm] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    color: C.text,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (tab === 'register' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      if (tab === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) setError(err.message)
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) setError(err.message)
        else setInfo('Check your email to confirm your account.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin,
    })
    setForgotSent(true)
    setLoading(false)
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword !== newConfirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) {
      setError(err.message)
    } else {
      await supabase.auth.signOut()
      setRecoveryMode(false)
      setInfo('Password updated. Sign in with your new password.')
    }
    setLoading(false)
  }

  const card = {
    width: '100%',
    maxWidth: 380,
    background: mode === 'dark' ? '#16161c' : '#ffffff',
    borderRadius: 20,
    border: `1px solid ${C.border}`,
    padding: '32px 28px',
    boxShadow: mode === 'dark' ? '0 8px 40px rgba(0,0,0,0.4)' : '0 8px 40px rgba(0,0,0,0.08)',
  }

  const logo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: C.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PiggyBank size={18} color="#fff" />
      </div>
      <span style={{ fontWeight: 800, fontSize: 16, color: C.warmText, letterSpacing: '-0.02em' }}>
        Budget
      </span>
    </div>
  )

  const wrap = (children) => (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: mode === 'dark' ? '#0e0e10' : '#c0d8c0',
      padding: 16,
      position: 'relative',
    }}>
      <button
        type="button"
        onClick={onToggleMode}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: C.muted, padding: 8, borderRadius: 8,
        }}
      >
        {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div style={card}>{children}</div>
    </div>
  )

  if (recoveryMode) {
    return wrap(<>
      {logo}
      <p style={{ margin: '0 0 20px', fontSize: 14, color: C.muted }}>Choose a new password.</p>
      <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="password" placeholder="New password" value={newPassword}
          onChange={e => setNewPassword(e.target.value)} required style={inputStyle} />
        <input type="password" placeholder="Confirm new password" value={newConfirm}
          onChange={e => setNewConfirm(e.target.value)} required style={inputStyle} />
        {error && <p style={{ margin: 0, fontSize: 13, color: '#e57373', textAlign: 'center' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{
          marginTop: 4, padding: '11px 0', borderRadius: 10, border: 'none',
          background: C.primary, color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          fontFamily: 'inherit', transition: 'opacity 0.15s',
        }}>
          {loading ? '…' : 'Set new password'}
        </button>
      </form>
    </>)
  }

  if (showForgot) {
    if (forgotSent) {
      return wrap(<>
        {logo}
        <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 15, color: C.text }}>Check your email</p>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted }}>
          If an account exists for {forgotEmail}, a reset link is on its way.
        </p>
        <button type="button" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}
          style={{ background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 13, padding: 0 }}>
          Back to sign in
        </button>
      </>)
    }
    return wrap(<>
      {logo}
      <p style={{ margin: '0 0 20px', fontSize: 14, color: C.muted }}>
        Enter your email and we'll send a reset link.
      </p>
      <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="Email" value={forgotEmail}
          onChange={e => setForgotEmail(e.target.value)} required style={inputStyle} />
        <button type="submit" disabled={loading} style={{
          marginTop: 4, padding: '11px 0', borderRadius: 10, border: 'none',
          background: C.primary, color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          fontFamily: 'inherit', transition: 'opacity 0.15s',
        }}>
          {loading ? '…' : 'Send reset link'}
        </button>
        <button type="button" onClick={() => setShowForgot(false)}
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, padding: 0 }}>
          Back to sign in
        </button>
      </form>
    </>)
  }

  return wrap(<>
    {logo}

    <div style={{
      display: 'flex', gap: 4, marginBottom: 24,
      background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      borderRadius: 10, padding: 4,
    }}>
      {['login', 'register'].map(t => (
        <button
          key={t}
          type="button"
          onClick={() => { setTab(t); setError(''); setInfo('') }}
          style={{
            flex: 1, padding: '7px 0', borderRadius: 7, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            background: tab === t ? (mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#fff') : 'transparent',
            color: tab === t ? C.text : C.muted,
            boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          {t === 'login' ? 'Sign in' : 'Create account'}
        </button>
      ))}
    </div>

    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input type="email" placeholder="Email" value={email}
        onChange={e => setEmail(e.target.value)} required style={inputStyle} />
      <input type="password" placeholder="Password" value={password}
        onChange={e => setPassword(e.target.value)} required style={inputStyle} />
      {tab === 'register' && (
        <input type="password" placeholder="Confirm password" value={confirm}
          onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
      )}

      {info && <p style={{ margin: 0, fontSize: 13, color: '#4caf50', textAlign: 'center' }}>{info}</p>}
      {error && <p style={{ margin: 0, fontSize: 13, color: '#e57373', textAlign: 'center' }}>{error}</p>}

      <button type="submit" disabled={loading} style={{
        marginTop: 4, padding: '11px 0', borderRadius: 10, border: 'none',
        background: C.primary, color: '#fff', fontWeight: 700, fontSize: 14,
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
        fontFamily: 'inherit', transition: 'opacity 0.15s',
      }}>
        {loading ? '…' : tab === 'login' ? 'Sign in' : 'Create account'}
      </button>

      {tab === 'login' && (
        <button type="button" onClick={() => { setShowForgot(true); setError(''); setForgotEmail(email) }}
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, padding: 0, marginTop: 2 }}>
          Forgot password?
        </button>
      )}
    </form>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 4px' }}>
      <div style={{ flex: 1, height: 1, background: C.border }} />
      <span style={{ fontSize: 12, color: C.muted }}>or</span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>

    <button
      type="button"
      onClick={handleGoogle}
      style={{
        width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 10,
        border: `1px solid ${C.border}`, background: 'transparent',
        color: C.text, fontWeight: 600, fontSize: 14, cursor: 'pointer',
        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
      Continue with Google
    </button>
  </>)
}
