import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useC } from '../../colors'

/**
 * One-time notice shown after the default-category rename (Food -> Food & Drink,
 * Transport -> Transportation, Housing -> Rent & Utilities, Health -> Medical, plus
 * five new categories) that aligned defaults with Plaid's transaction taxonomy ahead
 * of bank-linking support. Dismissal is persisted via user_settings.seen_category_migration_notice.
 */
export default function CategoryMigrationNoticeDialog({ onDismiss }) {
  const C = useC()

  const renames = [
    ['Food', 'Food & Drink'],
    ['Transport', 'Transportation'],
    ['Housing', 'Rent & Utilities'],
    ['Health', 'Medical'],
  ]

  return (
    <Dialog open onOpenChange={open => { if (!open) onDismiss() }}>
      <DialogContent style={{ maxWidth: 440 }}>
        <DialogHeader>
          <DialogTitle>Your categories got an update</DialogTitle>
        </DialogHeader>

        <p style={{ margin: '0 0 12px', fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
          We renamed a few default categories to match standard bank transaction categories —
          this will make it smoother to auto-categorize transactions once bank linking arrives.
          Your expenses, budgets, and rules all moved with the rename, nothing was lost.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          {renames.map(([oldName, newName]) => (
            <div key={oldName} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ color: C.muted }}>{oldName}</span>
              <span style={{ color: C.dimText }}>→</span>
              <span style={{ color: C.warmText, fontWeight: 600 }}>{newName}</span>
            </div>
          ))}
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Plus five new categories: Travel, Home Improvement, Shopping, Personal Care, and
            Government & Non-Profit.
          </div>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          You can rename or delete any category from <strong>Budgets → Categories</strong> —
          the only one you can't delete is <strong>Other</strong>, since it's the catch-all.
          A category with existing expenses needs those reassigned first.
        </p>

        <DialogFooter>
          <Button onClick={onDismiss} className="font-semibold">Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
