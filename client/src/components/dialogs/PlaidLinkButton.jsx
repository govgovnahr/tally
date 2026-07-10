import { useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useC } from '../../colors'
import api from '../../api.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Wraps Plaid Link. Fetches a link token on mount, opens Link on click, exchanges
 * the resulting public_token, and hands the exchange response ({item_id, mode,
 * pending_count | committed_count}) up to the caller so it can open the review
 * dialog when the first sync produced rows to review.
 *
 * If the backend reports this institution is already linked (active or previously
 * unlinked), the public_token isn't consumed yet — it's still valid for ~30min — so
 * confirming just retries the same exchange with force:true instead of re-opening Link.
 */
export default function PlaidLinkButton({ onLinked, disabled }) {
  const C = useC()
  const [linkToken, setLinkToken] = useState(null)
  const [exchanging, setExchanging] = useState(false)
  const [error, setError] = useState('')
  const [duplicatePrompt, setDuplicatePrompt] = useState(null) // { publicToken, institutionId, institutionName, previouslyUnlinked }

  useEffect(() => {
    api.post('/plaid/link-token')
      .then(r => setLinkToken(r.data.link_token))
      .catch(() => setError('Failed to start bank link.'))
  }, [])

  async function doExchange(publicToken, institutionId, institutionName, force) {
    setExchanging(true)
    setError('')
    try {
      const { data } = await api.post('/plaid/exchange-token', {
        public_token: publicToken,
        institution_id: institutionId,
        institution_name: institutionName,
        force,
      })
      if (data.duplicate_institution) {
        setDuplicatePrompt({
          publicToken, institutionId, institutionName,
          previouslyUnlinked: data.previously_unlinked,
        })
        return
      }
      onLinked(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to link account.')
    } finally {
      setExchanging(false)
    }
  }

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      doExchange(
        public_token,
        metadata?.institution?.institution_id ?? null,
        metadata?.institution?.name ?? null,
        false,
      )
    },
  })

  return (
    <div>
      <button
        type="button"
        onClick={() => open()}
        disabled={disabled || !ready || exchanging}
        style={{
          padding: '7px 16px', borderRadius: 8, border: 'none',
          background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
          cursor: (!ready || exchanging) ? 'not-allowed' : 'pointer',
          opacity: (!ready || exchanging) ? 0.6 : 1, fontFamily: 'inherit',
        }}
      >
        {exchanging ? 'Linking…' : 'Connect a bank account'}
      </button>
      <p style={{ margin: '6px 0 0', fontSize: 10, color: C.muted }}>Powered by Plaid</p>
      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#e57373' }}>{error}</p>}

      <Dialog open={!!duplicatePrompt} onOpenChange={v => { if (!v) setDuplicatePrompt(null) }}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>Already linked</DialogTitle>
          </DialogHeader>
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
            {duplicatePrompt?.institutionName || 'This bank'} is {duplicatePrompt?.previouslyUnlinked ? 'a bank you previously unlinked' : 'already linked'}.
            Linking it again may re-import transactions you already have. Continue anyway?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDuplicatePrompt(null)}>Cancel</Button>
            <Button
              onClick={() => {
                const p = duplicatePrompt
                setDuplicatePrompt(null)
                doExchange(p.publicToken, p.institutionId, p.institutionName, true)
              }}
              className="font-semibold"
            >
              Link anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
