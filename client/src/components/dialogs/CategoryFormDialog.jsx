import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '../../api.js'
import { useC, TYPE_PALETTE } from '../../colors'
import { ICON_REGISTRY, ICON_OPTIONS } from '../../expenseTypes.js'
import AlertBox from '../ui/AlertBox.jsx'
import ColorSwatch from '../ui/ColorSwatch.jsx'

const PRESET_COLORS = TYPE_PALETTE

export default function CategoryFormDialog({ open, onClose, onSaved, existing }) {
  const C = useC()
  const isEditing = Boolean(existing)
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? PRESET_COLORS[0])
  const [icon, setIcon] = useState(existing?.icon ?? ICON_OPTIONS[0].key)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required.')
    setLoading(true)
    try {
      if (isEditing) await api.put(`/expense-types/${existing.id}`, { name: name.trim(), color, icon })
      else await api.post('/expense-types', { name: name.trim(), color, icon })
      onSaved(); onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save category.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input autoFocus value={name} onChange={e => { setName(e.target.value); setError('') }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: C.muted }}>Icon</p>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ key, Icon, label }) => (
                <div
                  key={key}
                  title={label}
                  onClick={() => setIcon(key)}
                  className="flex items-center justify-center cursor-pointer rounded-lg transition-colors duration-150"
                  style={{
                    width: 38, height: 38,
                    border: icon === key ? `2px solid ${color}` : `2px solid ${C.border}`,
                    backgroundColor: icon === key ? C.hoverMed : 'transparent',
                  }}
                >
                  <Icon style={{ fontSize: 19, color: icon === key ? color : C.muted }} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: C.muted }}>Color</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <ColorSwatch key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color, border: `1px solid ${C.borderMed}` }} />
              <Input
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="#rrggbb"
                maxLength={7}
                className="w-28 text-sm"
              />
            </div>
          </div>
          {error && <AlertBox severity="error">{error}</AlertBox>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
