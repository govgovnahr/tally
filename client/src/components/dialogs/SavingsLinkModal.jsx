import { useState, useEffect } from 'react'
import { Sparkles, PiggyBank } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api, { getErrorMessage } from '../../api.js'
import { useC } from '../../colors'
import { ErrorMsg } from '../ui/AlertBox.jsx'

function getDefaultGoal(goals) {
  if (goals.length === 0) return null
  const prioritized = goals.filter(g => g.priority != null).sort((a, b) => a.priority - b.priority)
  return prioritized[0] ?? goals[0]
}

function autoLabel(defaultGoal) {
  if (!defaultGoal) return ''
  if (defaultGoal.priority != null) return `Auto-assigned · priority #${defaultGoal.priority} goal`
  return 'Auto-assigned · first active goal'
}

export default function SavingsLinkModal({ open, expenses, onClose, onDone }) {
  const C = useC()
  const [goals, setGoals] = useState([])
  const [defaultGoal, setDefaultGoal] = useState(null)
  const [assignments, setAssignments] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    api.get('/savings-goals').then(res => {
      const active = res.data.filter(g => !g.completed)
      setGoals(active)
      const def = getDefaultGoal(active)
      setDefaultGoal(def)
      const init = {}
      for (const exp of expenses) {
        init[exp.id] = def
          ? { mode: 'existing', goalId: def.id, newName: exp.name, newTarget: '', auto: true }
          : { mode: 'new', goalId: '', newName: exp.name, newTarget: '', auto: false }
      }
      setAssignments(init)
    })
  }, [open, expenses])

  function patch(expId, delta) {
    setAssignments(prev => ({ ...prev, [expId]: { ...prev[expId], ...delta } }))
  }

  function handleSelectChange(expId, val) {
    if (val === 'new') patch(expId, { mode: 'new', goalId: '', auto: false })
    else if (val === 'skip') patch(expId, { mode: 'skip', goalId: '', auto: false })
    else patch(expId, { mode: 'existing', goalId: val, auto: false })
  }

  async function handleConfirm() {
    setSaving(true)
    setError('')
    try {
      for (const exp of expenses) {
        const a = assignments[exp.id]
        if (!a || a.mode === 'skip') continue

        let goalId = a.goalId

        if (a.mode === 'new') {
          if (!a.newName.trim()) { setError('Goal name is required'); setSaving(false); return }
          const t = parseFloat(a.newTarget)
          if (!t || t <= 0) { setError('Target amount must be greater than 0'); setSaving(false); return }
          const res = await api.post('/savings-goals', {
            goal_type: 'one_time',
            name: a.newName.trim(),
            target: t,
          })
          goalId = res.data.id
        }

        if (!goalId) continue

        await api.post(`/savings-goals/${goalId}/contributions`, {
          amount: exp.amount,
          date: exp.date,
          expense_id: exp.id,
        })
      }
      onDone()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Savings Transactions</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {defaultGoal ? (
            <div
              className="flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: `${C.primary}12`, border: `1px solid ${C.primary}30` }}
            >
              <Sparkles size={15} className="flex-shrink-0 mt-0.5" style={{ color: C.primary }} />
              <span style={{ color: C.warmText }}>
                Pre-assigned to <strong>{defaultGoal.name}</strong>
                {defaultGoal.priority != null
                  ? ` (priority #${defaultGoal.priority} goal)`
                  : goals.length === 1 ? ' (your only active goal)' : ' (first active goal)'
                }. Change or clear any below.
              </span>
            </div>
          ) : (
            <p className="text-sm" style={{ color: C.muted }}>
              {expenses.length === 1
                ? 'This transaction was categorized as Savings. Assign it to a goal to track progress.'
                : `${expenses.length} transactions were categorized as Savings. Assign each to a goal.`}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {expenses.map(exp => {
              const a = assignments[exp.id] ?? { mode: 'skip', goalId: '', newName: exp.name, newTarget: '', auto: false }
              const selectValue = a.mode === 'skip' ? 'skip' : a.mode === 'new' ? 'new' : String(a.goalId)
              return (
                <div
                  key={exp.id}
                  className="rounded-xl p-3 transition-colors duration-150"
                  style={{
                    border: `1px solid ${a.auto ? `${C.primary}40` : C.border}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <PiggyBank size={15} style={{ color: C.primary }} />
                    <span className="text-sm font-medium">{exp.name}</span>
                    <span className="text-xs ml-auto whitespace-nowrap" style={{ color: C.muted }}>
                      ${exp.amount.toFixed(2)} · {exp.date}
                    </span>
                  </div>

                  <select
                    value={selectValue}
                    onChange={e => handleSelectChange(exp.id, e.target.value)}
                    className="h-9 w-full rounded-lg border px-3 text-sm bg-transparent"
                    style={{ borderColor: C.borderLight, color: C.warmText }}
                  >
                    {goals.map(g => (
                      <option key={g.id} value={String(g.id)}>{g.name}</option>
                    ))}
                    <option value="new">+ Create new goal…</option>
                    <option value="skip">Skip</option>
                  </select>

                  {a.auto && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Sparkles size={11} style={{ color: C.dimText }} />
                      <span className="text-xs" style={{ color: C.dimText }}>{autoLabel(defaultGoal)}</span>
                    </div>
                  )}

                  {a.mode === 'new' && (
                    <div className="flex gap-3 mt-3">
                      <Input
                        placeholder="Goal name"
                        value={a.newName}
                        onChange={e => patch(exp.id, { newName: e.target.value })}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Target ($)"
                        value={a.newTarget}
                        onChange={e => patch(exp.id, { newTarget: e.target.value })}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-28"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <ErrorMsg msg={error} />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving…' : `Assign ${expenses.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
