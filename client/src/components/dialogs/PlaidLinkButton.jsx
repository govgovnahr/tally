import { useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useC } from '../../colors'
import api from '../../api.js'
import usePlaidExchange from '../../lib/usePlaidExchange.js'
import PlaidDuplicateLinkDialog from './PlaidDuplicateLinkDialog.jsx'

/**
 * Wraps Plaid Link. Fetches a link token on mount, opens Link on click, exchanges
 * the resulting public_token, and hands the exchange response ({item_id, mode,
 * pending_count | committed_count}) up to the caller so it can open the review
 * dialog when the first sync produced rows to review.
 *
 * The fetched link token is persisted to localStorage — OAuth institutions (Chase,
 * BofA, ...) send the browser away to the bank's login page and back, which drops
 * all in-memory React state; PlaidOAuthResume.jsx reads this same key to resume
 * Link on the page that receives that redirect. Non-OAuth institutions never leave
 * the page, so this is a no-op for them beyond the storage write itself.
 */
export default function PlaidLinkButton({ onLinked, disabled }) {
  const C = useC()
  const [linkToken, setLinkToken] = useState(null)
  const [fetchError, setFetchError] = useState('')
  const { exchanging, error, duplicatePrompt, doExchange, confirmDuplicate, cancelDuplicate } = usePlaidExchange(onLinked)

  useEffect(() => {
    api.post('/plaid/link-token')
      .then(r => {
        localStorage.setItem('plaid_link_token', r.data.link_token)
        setLinkToken(r.data.link_token)
      })
      .catch(() => setFetchError('Failed to start bank link.'))
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      localStorage.removeItem('plaid_link_token')
      doExchange(
        public_token,
        metadata?.institution?.institution_id ?? null,
        metadata?.institution?.name ?? null,
        false,
      )
    },
    onExit: () => localStorage.removeItem('plaid_link_token'),
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
      {(fetchError || error) && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#e57373' }}>{fetchError || error}</p>}

      <PlaidDuplicateLinkDialog duplicatePrompt={duplicatePrompt} onCancel={cancelDuplicate} onConfirm={confirmDuplicate} />
    </div>
  )
}
