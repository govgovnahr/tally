import { useState } from 'react'
import api from '../api.js'
import './AddExpenseForm.css'

const EXPENSE_TYPES = ['Food', 'Transport', 'Housing', 'Entertainment', 'Health', 'Other']

const today = () => new Date().toISOString().split('T')[0]

export default function AddExpenseForm({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', amount: '', type: 'Food', date: today() })
  const [isRecurring, setIsRecurring] = useState(false)
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
      const res = await api.post('/expenses', {
        name: form.name.trim(),
        amount: parseFloat(form.amount),
        type: form.type,
        date: form.date,
        is_recurring: isRecurring ? 1 : 0,
      })
      onAdded(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add expense.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Add Expense</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input
              name="name"
              type="text"
              placeholder="e.g. Groceries"
              value={form.name}
              onChange={handleChange}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Amount ($)</label>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select name="type" value={form.type} onChange={handleChange}>
              {EXPENSE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
            />
          </div>
          <div className="form-group form-group-check">
            <label className="check-label">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={e => setIsRecurring(e.target.checked)}
              />
              <span>Recurring monthly expense</span>
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
