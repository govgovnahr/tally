import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import api from '../api.js'
import { EXPENSE_TYPES } from '../expenseTypes.js'

export default function BudgetEdit({ onSaved }) {
  const [limits, setLimits] = useState(
    Object.fromEntries(EXPENSE_TYPES.map(t => [t.type, '']))
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/budgets').then(res => {
      const map = Object.fromEntries(res.data.map(b => [b.type, b.monthly_limit > 0 ? String(b.monthly_limit) : '']))
      setLimits(prev => ({ ...prev, ...map }))
    }).finally(() => setLoading(false))
  }, [])

  function handleChange(type, value) {
    setLimits(prev => ({ ...prev, [type]: value }))
    setError('')
    setSaved(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const budgets = EXPENSE_TYPES
      .filter(t => limits[t.type] !== '' && Number(limits[t.type]) >= 0)
      .map(t => ({ type: t.type, monthly_limit: parseFloat(limits[t.type]) }))

    if (budgets.length === 0) return setError('Enter at least one budget limit.')

    setSaving(true)
    try {
      await api.post('/budgets', budgets)
      setSaved(true)
      onSaved()
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid rgba(240, 234, 214, 0.12)',
        borderRadius: 2,
        p: { xs: 3, sm: 4 },
      }}
    >
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
          Monthly Budget Goals
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Set a spending limit for each category. Leave blank to track without a limit.
        </Typography>
      </Box>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack spacing={1.5} mb={3}>
            {EXPENSE_TYPES.map(({ type, Icon, color }) => (
              <Stack
                key={type}
                direction="row"
                alignItems="center"
                spacing={1.5}
              >
                <Icon sx={{ fontSize: 22, color, flexShrink: 0 }} />
                <Typography
                  variant="body2"
                  sx={{ color: 'text.primary', flexGrow: 1, fontWeight: 500 }}
                >
                  {type}
                </Typography>
                <TextField
                  type="number"
                  placeholder="No limit"
                  value={limits[type]}
                  onChange={e => handleChange(type, e.target.value)}
                  size="small"
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                        $
                      </Typography>
                    ),
                  }}
                  inputProps={{ min: '0', step: '0.01', style: { textAlign: 'right' } }}
                  sx={{ width: 140 }}
                />
              </Stack>
            ))}
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
            {saved && (
              <Typography variant="body2" sx={{ color: 'primary.main' }}>
                Changes saved!
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={saving}
              sx={{ fontWeight: 600 }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </form>
      )}
    </Paper>
  )
}
