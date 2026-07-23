import { useState, useEffect } from 'react'
import { supabase } from '../../supabase.js'
import { useC } from '../../colors'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.jsx'

const instructionSection = { margin: '0 0 4px', fontWeight: 600 }
const instructionBody = { margin: '0 0 10px' }

/**
 * Enrolls a new TOTP factor on open (supabase.auth.mfa.enroll), shows the QR
 * code + manual-entry secret, and verifies the user's first code via
 * challengeAndVerify() to activate it. If the user backs out before verifying,
 * the freshly-created (but still unverified) factor is unenrolled — otherwise
 * it lingers on their account indefinitely without ever protecting anything.
 */
export default function MfaSetupDialog({ open, onOpenChange, onEnrolled }) {
  const C = useC()
  const [enrolling, setEnrolling] = useState(false)
  const [factor, setFactor] = useState(null) // { id, totp: { qr_code, secret } }
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setFactor(null)
      setCode('')
      setError('')
      return
    }
    setEnrolling(true)
    setError('')
    supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setFactor(data)
      })
      .finally(() => setEnrolling(false))
  }, [open])

  async function handleCancel() {
    if (factor) {
      try { await supabase.auth.mfa.unenroll({ factorId: factor.id }) } catch { /* best-effort cleanup */ }
    }
    onOpenChange(false)
  }

  async function handleVerify(e) {
    e.preventDefault()
    setVerifying(true)
    setError('')
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    setVerifying(false)
    if (err) { setError(err.message); return }
    onEnrolled()
  }

  const codeInputStyle = {
    width: '100%', padding: '9px 13px', borderRadius: 9, border: `1px solid ${C.border}`,
    background: C.bg, color: C.text, fontSize: 16, letterSpacing: '0.3em', textAlign: 'center',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleCancel() }}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader>
          <DialogTitle>Set up two-factor authentication</DialogTitle>
        </DialogHeader>

        {enrolling && <p style={{ fontSize: 13, color: C.muted }}>Preparing setup…</p>}
        {error && !factor && <p style={{ margin: 0, fontSize: 12, color: '#e57373' }}>{error}</p>}

        {factor && (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <img
                src={factor.totp.qr_code}
                alt="Scan this QR code with your authenticator"
                style={{ width: 180, height: 180, margin: '0 auto', background: '#fff', borderRadius: 8, padding: 8 }}
              />
            </div>

            <div>
              <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Can't scan? Enter this code manually
              </p>
              <p style={{
                margin: 0, fontSize: 13, fontFamily: 'monospace', color: C.text, wordBreak: 'break-all',
                background: C.bg, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
              }}>
                {factor.totp.secret}
              </p>
            </div>

            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              <p style={instructionSection}>iPhone/iPad</p>
              <p style={instructionBody}>
                Settings → Passwords → tap "+" → Set Up Verification Code → scan the QR code above (or enter the code manually). No separate app needed on iOS 15+.
              </p>
              <p style={instructionSection}>Android</p>
              <p style={instructionBody}>
                Google Password Manager → Settings → Authenticator → scan the QR code above. No separate app needed with recent Android versions.
              </p>
              <p style={instructionSection}>Desktop (Mac/Windows/Linux)</p>
              <p style={{ margin: 0 }}>
                Use your phone's camera to scan the QR code above, or a password manager with authenticator support (1Password, Bitwarden) — or enter the manual code into any TOTP app.
              </p>
            </div>

            <div>
              <label htmlFor="mfa-setup-code" style={{
                fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: 6, display: 'block',
              }}>
                Enter the 6-digit code
              </label>
              <input
                id="mfa-setup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                required
                style={codeInputStyle}
              />
            </div>

            {error && <p style={{ margin: 0, fontSize: 12, color: '#e57373' }}>{error}</p>}

            <DialogFooter>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: C.primary, color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: (verifying || code.length !== 6) ? 'not-allowed' : 'pointer',
                  opacity: (verifying || code.length !== 6) ? 0.6 : 1, fontFamily: 'inherit',
                }}
              >
                {verifying ? 'Verifying…' : 'Verify & enable'}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
