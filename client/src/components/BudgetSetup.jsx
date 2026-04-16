import { useState, useEffect } from 'react'
import { useC } from '../colors'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import SavingsIcon from '@mui/icons-material/Savings'
import BarChartIcon from '@mui/icons-material/BarChart'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { ICON_REGISTRY } from '../expenseTypes.js'

const FEATURES = [
  {
    icon: ReceiptLongIcon,
    label: 'Expense Tracking',
    desc: 'Log and categorize spending with custom types',
  },
  {
    icon: AccountBalanceIcon,
    label: 'Budget Goals',
    desc: 'Set limits per category with projected pacing',
  },
  {
    icon: SavingsIcon,
    label: 'Savings Goals',
    desc: 'Monthly, one-time, and emergency fund tracking',
  },
  {
    icon: BarChartIcon,
    label: 'Spending Analysis',
    desc: 'Trends, outliers, and month-over-month breakdowns',
  },
]

// ─── Welcome ────────────────────────────────────────────────────────────────

function WelcomeStep({ onStart, onSkip }) {
  const C = useC()
  return (
    <Stack spacing={3}>
      <Stack alignItems="center" spacing={1.5}>
        <AccountBalanceWalletIcon sx={{ fontSize: 52, color: 'primary.main' }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', textAlign: 'center' }}>
          Welcome to Budget Tracker
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 360 }}>
          A personal finance tool built around four core areas. Set up in under a minute, or skip and explore on your own.
        </Typography>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1.5,
        }}
      >
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <Box
            key={label}
            sx={{
              border: `1px solid ${C.borderSubtle}`,
              borderRadius: 1.5,
              p: 1.5,
              bgcolor: 'rgba(255,255,255,0.03)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <Icon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {label}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              {desc}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack spacing={1}>
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={onStart}
          sx={{ fontWeight: 600, py: 1.25 }}
        >
          Get Started
        </Button>
        <Button
          variant="text"
          color="inherit"
          fullWidth
          onClick={onSkip}
          sx={{ opacity: 0.45, fontSize: '0.8rem' }}
        >
          Skip setup — take me to the app
        </Button>
      </Stack>
    </Stack>
  )
}

// ─── Step 1: Income ──────────────────────────────────────────────────────────

function IncomeStep({ onNext, onSkip }) {
  const [name, setName] = useState('Monthly Salary')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return setError('Enter a valid income amount.')
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await api.post('/incomes', {
        name: name.trim() || 'Monthly Salary',
        amount: parsed,
        date: today,
        is_recurring: 1,
      })
      onNext()
    } catch {
      setError('Failed to save income. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Monthly Income
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Used for budget pacing and savings projections. You can add more income sources later.
          </Typography>
        </Stack>

        <TextField
          label="Income name"
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          size="small"
          fullWidth
          placeholder="Monthly Salary"
        />

        <TextField
          label="Monthly take-home amount"
          type="number"
          value={amount}
          onChange={e => { setAmount(e.target.value); setError('') }}
          size="small"
          fullWidth
          placeholder="0.00"
          InputProps={{
            startAdornment: (
              <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                $
              </Typography>
            ),
          }}
          inputProps={{ min: '0', step: '0.01' }}
          autoFocus
        />

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

        <Stack spacing={1}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ fontWeight: 600, py: 1.25 }}
          >
            {loading ? 'Saving...' : 'Next'}
          </Button>
          <Button
            type="button"
            variant="text"
            color="inherit"
            fullWidth
            onClick={onNext}
            sx={{ opacity: 0.45, fontSize: '0.8rem' }}
          >
            Skip this step
          </Button>
        </Stack>
      </Stack>
    </form>
  )
}

// ─── Step 2: Budget Limits ───────────────────────────────────────────────────

function BudgetLimitsStep({ onComplete, onSkip }) {
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

    if (budgets.length === 0) return setError('Enter at least one budget limit.')

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

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Monthly Budget Limits
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Set a spending cap per category. Leave blank to skip a category — you can set these anytime from Budget Goals.
          </Typography>
        </Stack>

        <Stack spacing={1.25}>
          {expenseTypes.map(t => {
            const IconComp = ICON_REGISTRY[t.icon]
            return (
              <Stack key={t.name} direction="row" alignItems="center" spacing={1.5}>
                {IconComp && <IconComp sx={{ fontSize: 20, color: t.color, flexShrink: 0 }} />}
                <Typography
                  variant="body2"
                  sx={{ color: 'text.primary', flexGrow: 1, fontWeight: 500 }}
                >
                  {t.name}
                </Typography>
                <TextField
                  type="number"
                  placeholder="—"
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

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

        <Stack spacing={1}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ fontWeight: 600, py: 1.25 }}
          >
            {loading ? 'Saving...' : 'Finish Setup'}
          </Button>
          <Button
            type="button"
            variant="text"
            color="inherit"
            fullWidth
            onClick={onSkip}
            sx={{ opacity: 0.45, fontSize: '0.8rem' }}
          >
            Skip this step
          </Button>
        </Stack>
      </Stack>
    </form>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const STEPS = ['income', 'budgets']

export default function BudgetSetup({ onComplete }) {
  const C = useC()
  const [phase, setPhase] = useState('welcome') // 'welcome' | 'income' | 'budgets'

  async function skipAll() {
    // Post a zero-limit budget so the app knows setup was acknowledged
    try {
      await api.post('/budgets', [{ type: 'Other', monthly_limit: 0 }])
    } catch {
      // ignore — best effort
    }
    onComplete()
  }

  const stepIndex = STEPS.indexOf(phase)
  const isStep = stepIndex !== -1

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
          border: `1px solid ${C.border}`,
          borderRadius: 2,
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 480,
        }}
      >
        {/* Step progress bar */}
        {isStep && (
          <Stack spacing={0.75} mb={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 500 }}>
                Step {stepIndex + 1} of {STEPS.length}
              </Typography>
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={skipAll}
                sx={{ opacity: 0.4, fontSize: '0.75rem', minWidth: 0, p: 0 }}
              >
                Skip all
              </Button>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={((stepIndex + 1) / STEPS.length) * 100}
              sx={{
                height: 3,
                borderRadius: 4,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': { bgcolor: 'primary.main' },
              }}
            />
          </Stack>
        )}

        {phase === 'welcome' && (
          <WelcomeStep
            onStart={() => setPhase('income')}
            onSkip={skipAll}
          />
        )}

        {phase === 'income' && (
          <IncomeStep
            onNext={() => setPhase('budgets')}
            onSkip={() => setPhase('budgets')}
          />
        )}

        {phase === 'budgets' && (
          <BudgetLimitsStep
            onComplete={onComplete}
            onSkip={skipAll}
          />
        )}
      </Paper>
    </Box>
  )
}
