import { useC } from '../../colors'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Shared by PlaidLinkButton and PlaidOAuthResume — same confirmation either way.
export default function PlaidDuplicateLinkDialog({ duplicatePrompt, onCancel, onConfirm }) {
  const C = useC()
  return (
    <Dialog open={!!duplicatePrompt} onOpenChange={v => { if (!v) onCancel() }}>
      <DialogContent style={{ maxWidth: 400 }}>
        <DialogHeader>
          <DialogTitle>Already linked</DialogTitle>
        </DialogHeader>
        <p style={{ margin: 0, fontSize: 14, color: C.muted }}>
          {duplicatePrompt?.institutionName || 'This bank'} is {duplicatePrompt?.previouslyUnlinked ? 'a bank you previously unlinked' : 'already linked'}.
          Linking it again may re-import transactions you already have. Continue anyway?
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} className="font-semibold">
            Link anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
