import { useState } from 'react'
import { PiggyBank, Sun, Moon } from 'lucide-react'
import api from '../api.js'
import { useC } from '../colors'

export default function AuthPage({ onAuth, mode, onToggleMode }) {
  const C = useC()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (tab === 'register' && password != confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const endpoint = tab === 'login' ? '/auth/login' : '/auth/register'
    api.post(endpoint, {email, password})
      .then(() => onAuth())
      .catch(err => setError(err.response?.data?.detail ?? 'Something went wrong.'))
      .finally(() => setLoading(false))
  }

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

  return (
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
      {/* Theme toggle */}
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

      <div style={{
        width: '100%',
        maxWidth: 380,
        background: mode === 'dark' ? '#16161c' : '#ffffff',
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        padding: '32px 28px',
        boxShadow: mode === 'dark' ? '0 8px 40px rgba(0,0,0,0.4)' : '0 8px 40px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
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

        {/* Tab toggle */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24,
          background: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          borderRadius: 10, padding: 4,
        }}>
          {['login', 'register'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setError('') }}
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
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {tab === 'register' && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={inputStyle}
            />
          )}

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: '#e57373', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: '11px 0',
              borderRadius: 10,
              border: 'none',
              background: C.primary,
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? '…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
