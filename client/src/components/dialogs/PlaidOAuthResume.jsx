import { useEffect } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useC } from '../../colors'
import usePlaidExchange from '../../lib/usePlaidExchange.js'
import PlaidDuplicateLinkDialog from './PlaidDuplicateLinkDialog.jsx'

function clearOAuthParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('oauth_state_id')
  window.history.replaceState({}, '', url.toString())
}

/**
 * Rendered by AccountPage instead of PlaidLinkButton when the app loads with an
 * oauth_state_id in the URL — Plaid Link sent the browser to an OAuth
 * institution's own login page, and the bank has now redirected back here. The
 * original link_token (persisted by PlaidLinkButton before the page ever left,
 * since the OAuth redirect drops all in-memory state) is required to resume —
 * Link cannot restart an OAuth handoff with a freshly-issued token.
 */
export default function PlaidOAuthResume({ onLinked, onDone }) {
  const C = useC()
  const linkToken = localStorage.getItem('plaid_link_token')
  const { exchanging, error, duplicatePrompt, doExchange, confirmDuplicate, cancelDuplicate } = usePlaidExchange((result) => {
    localStorage.removeItem('plaid_link_token')
    clearOAuthParams()
    onLinked(result)
    onDone()
  })

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: window.location.href,
    onSuccess: (public_token, metadata) => {
      doExchange(
        public_token,
        metadata?.institution?.institution_id ?? null,
        metadata?.institution?.name ?? null,
        false,
      )
    },
    onExit: () => {
      localStorage.removeItem('plaid_link_token')
      clearOAuthParams()
      onDone()
    },
  })

  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  if (!linkToken) {
    return (
      <div style={{ padding: '16px 0' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#e57373' }}>
          This bank link session expired or wasn't found. Please try connecting your bank again.
        </p>
        <button
          type="button"
          onClick={() => { clearOAuthParams(); onDone() }}
          style={{
            marginTop: 8, padding: '6px 14px', borderRadius: 8, border: 'none',
            background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Back to account
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
        {exchanging ? 'Finishing bank link…' : 'Resuming bank link…'}
      </p>
      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#e57373' }}>{error}</p>}
      <PlaidDuplicateLinkDialog duplicatePrompt={duplicatePrompt} onCancel={cancelDuplicate} onConfirm={confirmDuplicate} />
    </div>
  )
}
