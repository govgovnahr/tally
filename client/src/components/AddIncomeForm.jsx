import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import api from '../api.js'

const today = () => new Date().toISOString().split('T')[0]

export default function AddIncomeForm({ onClose, onAdded, income }) {
  const isEditing = Boolean(income)
  const [form, setForm] = useState({
    name: income?.name ?? '',
    amount: income?.amount ?? '',
    date: income?.date ?? today(),
  })
  const [isRecurring, setIsRecurring] = useState(income?.is_recurring === 1)
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
      }
      const res = isEditing
        ? await api.put(`/incomes/${income.id}`, payload)
        : await api.post('/incomes', payload)
      onAdded(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'add'} income.`)
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
        {isEditing ? 'Edit Income' : 'Add Income'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2.5}>
            <TextField
              name="name"
              label="Source"
              placeholder="e.g. Salary, Freelance"
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
              label="Recurring monthly income"
              sx={{ color: 'text.secondary' }}
            />
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
            {loading ? (isEditing ? 'Saving…' : 'Adding…') : (isEditing ? 'Save Changes' : 'Add Income')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
