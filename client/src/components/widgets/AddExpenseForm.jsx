import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useC } from '../../colors'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '../../api.js'
import { qk } from '../../queryKeys.js'
import { useExpenseTypes } from '../../ExpenseTypesContext.jsx'
import { useTutorial } from '../../TutorialContext.jsx'
import SavingsLinkModal from '../dialogs/SavingsLinkModal.jsx'
import PolishedCheckbox from '../inputs/PolishedCheckbox.jsx'
import FieldGroup from '../ui/FieldGroup.jsx'
import { ErrorMsg } from '../ui/AlertBox.jsx'

const today = () => new Date().toISOString().split('T')[0]

export default function AddExpenseForm({ onClose, onAdded, expense, prefill }) {
  const C = useC()
  const queryClient = useQueryClient()
  const { typeNames } = useExpenseTypes()
  const { suggestOnboardingTour } = useTutorial() ?? {}
  useEffect(() => { suggestOnboardingTour?.() }, [])
  const isEditing = Boolean(expense)
  const [form, setForm] = useState({
    name: expense?.name ?? prefill?.name ?? '',
    amount: expense?.amount ?? prefill?.amount ?? '',
    type: expense?.type ?? (prefill?.type && typeNames.includes(prefill.type) ? prefill.type : typeNames[0] ?? ''),
    date: expense?.date ?? prefill?.date ?? today(),
  })
  const [isRecurring, setIsRecurring] = useState(expense?.is_recurring === 1)
  const [rememberRule, setRememberRule] = useState(false)
  const [rulePattern, setRulePattern] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingsExpense, setSavingsExpense] = useState(null)
  const [nlText, setNlText] = useState('')
  const [nlLoading, setNlLoading] = useState(false)
  const [nlError, setNlError] = useState('')
  const typeAutoSet = useRef(!isEditing)

  const { data: settings } = useQuery({
    queryKey: qk.settings(),
    queryFn: () => api.get('/settings').then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const aiEnabled = settings?.ai_enabled ?? false

  async function handleNlParse() {
    if (!nlText.trim()) return
    setNlLoading(true)
    setNlError('')
    try {
      const { data } = await api.post('/ai/parse-expense', {
        text: nlText.trim(),
        expense_types: typeNames,
      })
      typeAutoSet.current = false
      setForm(f => ({
        ...f,
        name: data.name || f.name,
        amount: data.amount > 0 ? String(data.amount) : f.amount,
        date: data.date || f.date,
        type: data.type && typeNames.includes(data.type) ? data.type : f.type,
      }))
      setNlText('')
    } catch (err) {
      setNlError(err.response?.data?.detail || 'Could not parse. Try again.')
    } finally {
      setNlLoading(false)
    }
  }
  const debounceTimer = useRef(null)

  useEffect(() => {
    if (!typeAutoSet.current) return
    const name = form.name.trim()
    if (!name) return
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/import/infer-type', { params: { name } })
        if (typeAutoSet.current) {
          setForm(f => ({ ...f, type: res.data.type }))
        }
      } catch {
        // silently ignore
      }
    }, 500)
    return () => clearTimeout(debounceTimer.current)
  }, [form.name])

  function cleanPattern(name) {
    return name
      .replace(/\d{2}\/\d{2}/g, '')
      .replace(/[A-Z]{2,3}-[A-Z]{2,3}\d+/gi, '')
      .replace(/\b[A-Z]{2}\b$/g, '')
      .replace(/\s+/g, ' ').trim()
  }

  function handleChange(e) {
    if (e.target.name === 'type') typeAutoSet.current = false
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Name is required.')
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0)
      return setError('Enter a valid amount greater than 0.')
    if (!form.date) return setError('Date is required.')

    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        amount: parseFloat(form.amount),
        type: form.type,
        date: form.date,
        is_recurring: isRecurring ? 1 : 0,
      }
      const res = isEditing
        ? await api.put(`/expenses/${expense.id}`, payload)
        : await api.post('/expenses', payload)
      if (rememberRule && rulePattern.trim()) {
        await api.post('/import-rules', { pattern: rulePattern.trim(), expense_type: form.type })
      }
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      if (!isEditing && form.type === 'Savings') {
        setSavingsExpense(res.data)
        return
      }
      onAdded?.(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'add'} expense.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm" data-tour="add-expense-modal">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isEditing && aiEnabled && (
            <div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Sparkles
                    size={13}
                    color={C.primary}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    value={nlText}
                    onChange={e => { setNlText(e.target.value); setNlError('') }}
                    placeholder="Describe your expense in plain English…"
                    disabled={nlLoading}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleNlParse() } }}
                    style={{
                      width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                      borderRadius: 8, border: `1px solid ${C.borderLight}`,
                      background: 'transparent', color: C.warmText, fontSize: 13,
                      outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                      opacity: nlLoading ? 0.6 : 1,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleNlParse}
                  disabled={nlLoading || !nlText.trim()}
                  style={{
                    padding: '7px 13px', borderRadius: 8, border: 'none',
                    background: C.primary, color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: nlLoading || !nlText.trim() ? 'not-allowed' : 'pointer',
                    opacity: nlLoading || !nlText.trim() ? 0.55 : 1,
                    fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                >
                  {nlLoading ? '…' : 'Parse'}
                </button>
              </div>
              {nlError && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: C.overBudget }}>{nlError}</p>
              )}
              <div style={{ height: 1, background: C.hoverStrong, margin: '14px 0 2px' }} />
            </div>
          )}
          <FieldGroup label="Name">
            <Input
              name="name"
              placeholder="e.g. Groceries"
              value={form.name}
              onChange={handleChange}
              autoFocus
            />
          </FieldGroup>
          <FieldGroup label="Amount ($)">
            <Input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
            />
          </FieldGroup>
          <FieldGroup label="Type">
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="h-9 w-full rounded-lg border px-3 text-sm bg-transparent"
              style={{ borderColor: C.borderLight, color: C.warmText }}
            >
              {typeNames.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Date">
            <Input
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
            />
          </FieldGroup>
          <PolishedCheckbox
            checked={isRecurring}
            onChange={setIsRecurring}
            label="Recurring monthly expense"
          />
          {isEditing && (
            <>
              <PolishedCheckbox
                checked={rememberRule}
                onChange={v => {
                  setRememberRule(v)
                  if (v) setRulePattern(cleanPattern(form.name))
                }}
                label="Learn from this edit"
              />
              {rememberRule && (
                <FieldGroup label="Auto-categorize transactions containing">
                  <Input
                    value={rulePattern}
                    onChange={e => setRulePattern(e.target.value)}
                    placeholder="keyword"
                  />
                  <p className="text-xs" style={{ color: C.muted }}>
                    Transactions with "{rulePattern}" will be set to: {form.type}
                  </p>
                </FieldGroup>
              )}
            </>
          )}
          <ErrorMsg msg={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Expense')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {savingsExpense && (
        <SavingsLinkModal
          open
          expenses={[savingsExpense]}
          onClose={() => { setSavingsExpense(null); onAdded(savingsExpense); onClose() }}
          onDone={() => { setSavingsExpense(null); onAdded(savingsExpense); onClose() }}
        />
      )}
    </Dialog>
  )
}
