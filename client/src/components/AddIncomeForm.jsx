import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useC } from '../colors'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import PolishedCheckbox from './PolishedCheckbox.jsx'
import FieldGroup from './FieldGroup.jsx'
import { ErrorMsg } from './AlertBox.jsx'

const today = () => new Date().toISOString().split('T')[0]

export default function AddIncomeForm({ onClose, onAdded, income }) {
  const C = useC()
  const queryClient = useQueryClient()
  const { expenseTypes } = useExpenseTypes()
  const isEditing = Boolean(income)
  const [form, setForm] = useState({
    name: income?.name ?? '',
    amount: income?.amount ?? '',
    date: income?.date ?? today(),
  })
  const [isRecurring, setIsRecurring] = useState(income?.is_recurring === 1)
  const [creditEnabled, setCreditEnabled] = useState(Boolean(income?.credit_type))
  const [creditType, setCreditType] = useState(income?.credit_type ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
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
        date: form.date,
        is_recurring: isRecurring ? 1 : 0,
        credit_type: creditEnabled && creditType ? creditType : null,
      }
      const res = isEditing
        ? await api.put(`/incomes/${income.id}`, payload)
        : await api.post('/incomes', payload)
      queryClient.invalidateQueries({ queryKey: ['incomes'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
      onAdded?.(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'add'} income.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Income' : 'Add Income'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup label="Source">
            <Input
              name="name"
              placeholder="e.g. Salary, Freelance"
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
            label="Recurring monthly income"
            accentColor={C.income}
          />
          <PolishedCheckbox
            checked={creditEnabled}
            onChange={v => { setCreditEnabled(v); if (!v) setCreditType('') }}
            label="Apply as spending credit"
            accentColor={C.nearGoal}
          />
          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: creditEnabled ? '80px' : '0px' }}
          >
            <FieldGroup label="Credit to category">
              <select
                value={creditType}
                onChange={e => setCreditType(e.target.value)}
                className="h-9 w-full rounded-lg border px-3 text-sm bg-transparent"
                style={{ borderColor: C.borderLight, color: C.warmText }}
              >
                <option value="">Select category…</option>
                {expenseTypes.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </FieldGroup>
          </div>
          <ErrorMsg msg={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: C.income, color: '#000' }}
            >
              {loading ? (isEditing ? 'Saving…' : 'Adding…') : (isEditing ? 'Save Changes' : 'Add Income')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
