import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import AlertBox from '../ui/AlertBox.jsx'
import ReviewTable from '../shared/ReviewTable.jsx'
import api from '../../api.js'

/**
 * First-sync review step for a newly-linked Plaid item — same review/override/commit
 * flow as CSV import's ReviewTable, but reading from and committing to the
 * plaid_pending_transactions staging table instead of an uploaded file.
 */
export default function PlaidReviewDialog({ itemId, onClose, onCommitted }) {
  const [loading, setLoading] = useState(true)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [activeFilter, setActiveFilter] = useState('fallback')

  useEffect(() => {
    api.get(`/plaid/items/${itemId}/pending-review`)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Failed to load transactions.'))
      .finally(() => setLoading(false))
  }, [itemId])

  async function handleCommit() {
    setCommitting(true)
    setError('')
    try {
      const confirmed_types = Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v)
      )
      const { data: result } = await api.post(`/plaid/items/${itemId}/commit-review`, { confirmed_types })
      onCommitted(result)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to commit transactions.')
    } finally {
      setCommitting(false)
    }
  }

  const rows = data?.rows ?? []
  const expenseRows = rows.filter(r => r.record_type === 'expense')
  const incomeCount = rows.filter(r => r.record_type === 'income').length

  return (
    <Dialog open onOpenChange={open => { if (!open && !committing) onClose() }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Review Imported Transactions</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}

        {!loading && data && (
          rows.length === 0 ? (
            <AlertBox severity="info">No transactions found for this account yet.</AlertBox>
          ) : (
            <ReviewTable
              rows={expenseRows}
              validTypes={data.valid_types}
              incomeCount={incomeCount}
              aiEnabled
              overrides={overrides}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onOverride={(id, category) => setOverrides(prev => ({ ...prev, [id]: category }))}
              error={error}
            />
          )
        )}

        {!loading && !data && error && <AlertBox severity="error">{error}</AlertBox>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={committing}>Skip for now</Button>
          <Button onClick={handleCommit} disabled={committing || loading || rows.length === 0} className="font-semibold">
            {committing
              ? <><Loader2 className="animate-spin mr-2" size={16} />Importing…</>
              : `Import ${rows.length} transaction${rows.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
