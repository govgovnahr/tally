import { useState, useEffect, useRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'

const today = () => new Date().toISOString().split('T')[0]

export default function AddExpenseForm({ onClose, onAdded, expense }) {
  const { typeNames } = useExpenseTypes()
  const isEditing = Boolean(expense)
  const [form, setForm] = useState({
    name: expense?.name ?? '',
    amount: expense?.amount ?? '',
    type: expense?.type ?? typeNames[0] ?? '',
    date: expense?.date ?? today(),
  })
  const [isRecurring, setIsRecurring] = useState(expense?.is_recurring === 1)
  const [rememberRule, setRememberRule] = useState(false)
  const [rulePattern, setRulePattern] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Track whether the type was set by auto-categorization (vs manually by the user)
  const typeAutoSet = useRef(!isEditing)
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
      onAdded(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'add'} expense.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          border: '1px solid rgba(240, 234, 214, 0.12)',
        },
      }}
    >
      <DialogTitle sx={{ color: 'text.primary', fontWeight: 600 }}>
        {isEditing ? 'Edit Expense' : 'Add Expense'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2.5}>
            <TextField
              name="name"
              label="Name"
              placeholder="e.g. Groceries"
              value={form.name}
              onChange={handleChange}
              autoFocus
              fullWidth
              size="small"
              variant="outlined"
            />
            <TextField
              name="amount"
              label="Amount ($)"
              type="number"
              inputProps={{ min: '0.01', step: '0.01' }}
              placeholder="0.00"
              value={form.amount}
              onChange={handleChange}
              fullWidth
              size="small"
              variant="outlined"
            />
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel>Type</InputLabel>
              <Select
                name="type"
                value={form.type}
                onChange={handleChange}
                label="Type"
              >
                {typeNames.map(t => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              name="date"
              label="Date"
              type="date"
              value={form.date}
              onChange={handleChange}
              fullWidth
              size="small"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label="Recurring monthly expense"
              sx={{ color: 'text.secondary' }}
            />
            {isEditing && (
              <>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberRule}
                      onChange={e => {
                        setRememberRule(e.target.checked)
                        if (e.target.checked) setRulePattern(cleanPattern(form.name))
                      }}
                      color="primary"
                      size="small"
                    />
                  }
                  label="Remember this categorization for future imports"
                  sx={{ color: 'text.secondary' }}
                />
                {rememberRule && (
                  <TextField
                    label="Auto-categorize transactions containing"
                    value={rulePattern}
                    onChange={e => setRulePattern(e.target.value)}
                    fullWidth
                    size="small"
                    variant="outlined"
                    helperText={`Future imports with "${rulePattern}" in the description will be set to ${form.type}`}
                  />
                )}
              </>
            )}
            {error && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {error}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="text" color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Expense')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
