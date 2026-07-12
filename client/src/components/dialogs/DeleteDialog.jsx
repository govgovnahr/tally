import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import api, { getErrorMessage } from '../../api.js'
import { useC } from '../../colors'
import AlertBox from '../ui/AlertBox.jsx'

export default function DeleteDialog({ open, onClose, onDeleted, type, otherTypes }) {
  const C = useC()
  const [reassignTo, setReassignTo] = useState('')
  const [error, setError] = useState('')
  const [needsReassign, setNeedsReassign] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const params = reassignTo ? { reassign_to: reassignTo } : {}
      await api.delete(`/expense-types/${type.id}`, { params })
      onDeleted(); onClose()
    } catch (err) {
      const detail = getErrorMessage(err, '')
      if (err.response?.status === 409) { setNeedsReassign(true); setError(detail) }
      else setError(detail || 'Failed to delete category.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete "{type?.name}"?</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3 pt-1">
          {!needsReassign && (
            <p className="text-sm" style={{ color: C.muted }}>
              This will permanently delete the category and remove its budget goal.
            </p>
          )}
          {needsReassign && (
            <>
              <AlertBox severity="warning">{error}</AlertBox>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Reassign expenses to</label>
                <select
                  value={reassignTo}
                  onChange={e => setReassignTo(e.target.value)}
                  className="h-9 w-full rounded-lg border px-3 text-sm bg-transparent"
                  style={{ borderColor: C.borderLight, color: C.warmText }}
                >
                  <option value="">Select a category</option>
                  {otherTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </>
          )}
          {error && !needsReassign && <AlertBox severity="error">{error}</AlertBox>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading || (needsReassign && !reassignTo)}>
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
