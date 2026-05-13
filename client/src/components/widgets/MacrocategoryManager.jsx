import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '../../api.js'
import { useC, TYPE_PALETTE } from '../../colors'
import { useExpenseTypes } from '../../ExpenseTypesContext.jsx'
import AlertBox from '../ui/AlertBox.jsx'
import IconButton from '../ui/IconButton.jsx'
import ColorSwatch from '../ui/ColorSwatch.jsx'
import CollapsibleSection from '../ui/CollapsibleSection.jsx'
import ColorDot from '../ui/ColorDot.jsx'
import DollarInput from '../inputs/DollarInput.jsx'

const PRESET_COLORS = TYPE_PALETTE

export default function MacrocategoryManager() {
  const C = useC()
  const { macrocategories, reloadMacros } = useExpenseTypes()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [newBudget, setNewBudget] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [error, setError] = useState('')

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return setError('Name is required.')
    try {
      await api.post('/macrocategories', { name, color: newColor, budget_limit: newBudget ? parseFloat(newBudget) : null })
      setNewName(''); setNewBudget(''); setError(''); reloadMacros()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to save.') }
  }

  async function handleSaveEdit() {
    const name = editName.trim()
    if (!name) return setError('Name is required.')
    try {
      await api.put(`/macrocategories/${editTarget.id}`, { name, color: editColor, budget_limit: editBudget ? parseFloat(editBudget) : null })
      setEditTarget(null); setError(''); reloadMacros()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to save.') }
  }

  async function handleDelete(id) {
    try { await api.delete(`/macrocategories/${id}`); reloadMacros() } catch { /* ignore */ }
  }

  const extra = macrocategories.length > 0 && (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: C.hoverStrong, color: C.muted }}>
      {macrocategories.length}
    </span>
  )

  return (
    <CollapsibleSection
      divider
      title="Macrocategories"
      subtitle="Group categories into larger buckets."
      extra={extra}
    >
      <div className="flex flex-col gap-2 pb-5 sm:pb-7">
          {macrocategories.map(m => editTarget?.id === m.id ? (
            <div key={m.id} className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-xl"
              style={{ border: `1px solid ${m.color}`, backgroundColor: C.subtleBg }}>
              <ColorDot color={editColor} size="md" />
              <Input value={editName} onChange={e => setEditName(e.target.value)} autoFocus className="flex-1 h-8 text-sm" />
              <DollarInput
                value={editBudget}
                onChange={e => setEditBudget(e.target.value)}
                placeholder="No ceiling"
                className="w-28"
                inputClassName="h-8 w-28"
              />
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {PRESET_COLORS.map(c => <ColorSwatch key={c} color={c} selected={editColor === c} onClick={() => setEditColor(c)} />)}
              </div>
              <Button size="sm" onClick={handleSaveEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditTarget(null); setError('') }}>Cancel</Button>
            </div>
          ) : (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors duration-150"
              style={{ border: `1px solid ${C.hoverStrong}` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `${m.color}14`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <ColorDot color={m.color} size="md" />
              <span className="text-sm font-medium flex-1" style={{ color: C.warmText }}>{m.name}</span>
              {m.budget_limit > 0 && (
                <span className="text-sm" style={{ color: C.muted }}>${m.budget_limit.toFixed(0)} ceiling</span>
              )}
              <IconButton onClick={() => { setEditTarget(m); setEditName(m.name); setEditColor(m.color); setEditBudget(m.budget_limit ? String(m.budget_limit) : ''); setError('') }}>
                <Pencil size={14} />
              </IconButton>
              <IconButton onClick={() => handleDelete(m.id)} hoverColor={C.overBudget}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}

          {/* Add new */}
          <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-xl"
            style={{ border: `1px dashed ${C.borderMed}` }}>
            <Input placeholder="Group name" value={newName}
              onChange={e => { setNewName(e.target.value); setError('') }}
              className="flex-1 h-8 text-sm min-w-[120px]" />
            <DollarInput
              value={newBudget}
              onChange={e => setNewBudget(e.target.value)}
              placeholder="No ceiling"
              className="w-28"
              inputClassName="h-8 w-28"
            />
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {PRESET_COLORS.map(c => <ColorSwatch key={c} color={c} selected={newColor === c} onClick={() => setNewColor(c)} />)}
            </div>
            <Button size="sm" variant="outline" onClick={handleAdd}>
              <Plus size={14} className="mr-1" />Add
            </Button>
          </div>

          {error && <AlertBox severity="error">{error}</AlertBox>}
        </div>
    </CollapsibleSection>
  )
}
