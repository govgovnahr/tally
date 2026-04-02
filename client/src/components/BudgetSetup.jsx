import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { ICON_REGISTRY } from '../expenseTypes.js'

export default function BudgetSetup({ onComplete }) {
  const { expenseTypes } = useExpenseTypes()
  const [limits, setLimits] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (expenseTypes.length > 0) {
      setLimits(Object.fromEntries(expenseTypes.map(t => [t.name, ''])))
    }
  }, [expenseTypes])

  function handleChange(type, value) {
    setLimits(prev => ({ ...prev, [type]: value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const budgets = expenseTypes
      .filter(t => limits[t.name] !== '' && Number(limits[t.name]) > 0)
      .map(t => ({ type: t.name, monthly_limit: parseFloat(limits[t.name]) }))

    if (budgets.length === 0) {
      return setError('Enter at least one budget limit to get started.')
    }

    setLoading(true)
    try {
      await api.post('/budgets', budgets)
      onComplete()
    } catch {
      setError('Failed to save budgets. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    const firstType = expenseTypes[0]?.name ?? 'Other'
    await api.post('/budgets', [{ type: firstType, monthly_limit: 0 }])
    onComplete()
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
        py: 4,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid rgba(240, 234, 214, 0.12)',
          borderRadius: 2,
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 480,
        }}
      >
        <Stack alignItems="center" spacing={1.5} mb={3}>
          <AccountBalanceWalletIcon sx={{ fontSize: 48, color: 'primary.main' }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', textAlign: 'center' }}>
            Welcome to Budget Tracker
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Set your monthly spending goals to get started. You can update these anytime.
          </Typography>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack spacing={1.5} mb={3}>
            {expenseTypes.map(t => {
              const IconComp = ICON_REGISTRY[t.icon]
              return (
                <Stack key={t.name} direction="row" alignItems="center" spacing={1.5}>
                  {IconComp && <IconComp sx={{ fontSize: 22, color: t.color, flexShrink: 0 }} />}
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.primary', flexGrow: 1, fontWeight: 500 }}
                  >
                    {t.name}
                  </Typography>
                  <TextField
                    type="number"
                    placeholder="0.00"
                    value={limits[t.name] ?? ''}
                    onChange={e => handleChange(t.name, e.target.value)}
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
                    sx={{ width: 120 }}
                  />
                </Stack>
              )
            })}
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={1}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
              sx={{ fontWeight: 600, py: 1.25 }}
            >
              {loading ? 'Saving...' : 'Get Started'}
            </Button>
            <Button
              type="button"
              variant="text"
              color="inherit"
              fullWidth
              onClick={handleSkip}
              sx={{ opacity: 0.5 }}
            >
              Skip for now
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}
