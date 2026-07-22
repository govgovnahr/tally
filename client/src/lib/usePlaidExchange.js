import { useState } from 'react'
import api from '../api.js'

/**
 * Shared POST /plaid/exchange-token flow (including the "this institution is
 * already linked, continue anyway?" confirmation) used by both PlaidLinkButton
 * (fresh Link open) and PlaidOAuthResume (resuming after an OAuth institution's
 * full-page redirect) — one exchange implementation, two ways of getting a
 * public_token out of react-plaid-link.
 */
export default function usePlaidExchange(onLinked) {
  const [exchanging, setExchanging] = useState(false)
  const [error, setError] = useState('')
  const [duplicatePrompt, setDuplicatePrompt] = useState(null) // { publicToken, institutionId, institutionName, previouslyUnlinked }

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

  function confirmDuplicate() {
    const p = duplicatePrompt
    setDuplicatePrompt(null)
    doExchange(p.publicToken, p.institutionId, p.institutionName, true)
  }

  function cancelDuplicate() {
    setDuplicatePrompt(null)
  }

  return { exchanging, error, duplicatePrompt, doExchange, confirmDuplicate, cancelDuplicate }
}
