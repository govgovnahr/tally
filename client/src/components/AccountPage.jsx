import { useState } from 'react'
import { LogOut, KeyRound, User } from 'lucide-react'
import { supabase } from '../supabase.js'
import { useC } from '../colors'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog.jsx'

export default function AccountPage({ user, onLogout }) {
  const C = useC()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwStatus, setPwStatus] = useState(null) // { type: 'success'|'error', msg }
  const [pwLoading, setPwLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwStatus(null)
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: 'error', msg: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setPwStatus({ type: 'error', msg: 'Password must be at least 8 characters.' })
      return
    }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwStatus({ type: 'error', msg: error.message })
    } else {
      setPwStatus({ type: 'success', msg: 'Password updated.' })
      setNewPassword('')
      setConfirmPassword('')
      setShowForm(false)
    }
      .finally(() => setPwLoading(false))
  }

  const section = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: '20px 24px',
    marginBottom: 16,
  }

  const inputStyle = {
    width: '100%',
    padding: '9px 13px',
    borderRadius: 9,
    border: `1px solid ${C.border}`,
    background: C.bg,
    color: C.text,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const label = {
    fontSize: 12,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    display: 'block',
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 24px', letterSpacing: '-0.02em' }}>
        Account
      </h1>

      {/* Profile */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: C.primaryTint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <User size={20} color={C.primary} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: C.text }}>{user?.email}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>Your account email</p>
          </div>
        </div>
      </div>

      {/* Password */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showForm ? 20 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyRound size={16} color={C.muted} />
            <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>Password</span>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => { setShowForm(true); setPwStatus(null) }}
              style={{
                padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Change
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={label}>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={label}>Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {pwStatus && (
              <p style={{
                margin: 0, fontSize: 13, textAlign: 'left',
                color: pwStatus.type === 'success' ? '#4caf50' : '#e57373',
              }}>
                {pwStatus.msg}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="submit"
                disabled={pwLoading}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, border: 'none',
                  background: C.primary, color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: pwLoading ? 'not-allowed' : 'pointer',
                  opacity: pwLoading ? 0.7 : 1, fontFamily: 'inherit',
                }}
              >
                {pwLoading ? '…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setPwStatus(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}
                style={{
                  padding: '9px 16px', borderRadius: 9, border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Sign out */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.text }}>Sign out</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>Sign out of this device</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid rgba(229,115,115,0.4)',
              background: 'rgba(229,115,115,0.08)',
              color: '#e57373', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <DialogContent style={{ maxWidth: 360 }}>
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
          </DialogHeader>
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
            You'll need to sign in again to access your account.
          </p>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setConfirmLogout(false)}
              style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: '#e57373', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Sign out
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
