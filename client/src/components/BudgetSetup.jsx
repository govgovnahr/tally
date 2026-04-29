import { useState, useEffect } from 'react'
import { useC } from '../colors'
import { Card } from 'glasscn-ui'
import { Receipt, Landmark, PiggyBank, BarChart2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { ICON_REGISTRY } from '../expenseTypes.js'
import { TallyLogo } from './TallyLogo.jsx'

const FEATURES = [
  { icon: Receipt,   label: 'Expense Tracking', desc: 'Log and categorize spending with custom types' },
  { icon: Landmark,  label: 'Budget Goals',      desc: 'Set limits per category with projected pacing' },
  { icon: PiggyBank, label: 'Savings Goals',     desc: 'Monthly, one-time, and emergency fund tracking' },
  { icon: BarChart2, label: 'Spending Analysis', desc: 'Trends, outliers, and month-over-month breakdowns' },
]

function ErrorMsg({ msg }) {
  const C = useC()
  if (!msg) return null
  return (
    <div
      className="text-sm px-3 py-2 rounded-lg"
      style={{ backgroundColor: `${C.overBudget}18`, border: `1px solid ${C.overBudget}40`, color: C.overBudget }}
    >
      {msg}
    </div>
  )
}

// ─── Welcome ────────────────────────────────────────────────────────────────

function WelcomeStep({ onStart, onSkip }) {
  const C = useC()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        <TallyLogo dark={C.mode === 'dark'} />
        <h2 className="text-xl font-bold text-center">Welcome to Tally</h2>
        <p className="text-sm text-center max-w-[360px]" style={{ color: C.muted }}>
          A personal finance tool built around four core areas. Set up in under a minute, or skip and explore on your own.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ border: `1px solid ${C.borderMed}`, backgroundColor: C.subtleBg }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={18} style={{ color: C.primary }} />
              <span className="text-xs font-semibold">{label}</span>
            </div>
            <p className="text-xs leading-snug" style={{ color: C.muted }}>{desc}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onStart} className="w-full font-semibold py-5">Get Started</Button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-sm bg-transparent border-none cursor-pointer font-[inherit] py-2 opacity-45"
          style={{ color: C.warmText }}
        >
          Skip setup — take me to the app
        </button>
      </div>
    </div>
  )
}

// ─── Step 1: Income ──────────────────────────────────────────────────────────

function IncomeStep({ onNext, onSkip }) {
  const C = useC()
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold">Monthly Income</h3>
        <p className="text-sm" style={{ color: C.muted }}>
          Used for budget pacing and savings projections. You can add more income sources later.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Income name</label>
        <Input
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          placeholder="Monthly Salary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Monthly take-home amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>$</span>
          <Input
            type="number"
            className="pl-7"
            value={amount}
            onChange={e => { setAmount(e.target.value); setError('') }}
            placeholder="0.00"
            min="0"
            step="0.01"
            autoFocus
          />
        </div>
      </div>

      <ErrorMsg msg={error} />

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={loading} className="w-full font-semibold py-5">
          {loading ? 'Saving...' : 'Next'}
        </Button>
        <button
          type="button"
          onClick={onNext}
          className="w-full text-sm bg-transparent border-none cursor-pointer font-[inherit] py-2 opacity-45"
          style={{ color: C.warmText }}
        >
          Skip this step
        </button>
      </div>
    </form>
  )
}

// ─── Step 2: Budget Limits ───────────────────────────────────────────────────

function BudgetLimitsStep({ onComplete, onSkip }) {
  const C = useC()
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold">Monthly Budget Limits</h3>
        <p className="text-sm" style={{ color: C.muted }}>
          Set a spending cap per category. Leave blank to skip — you can set these anytime from Budget Goals.
        </p>
      </div>

      <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
        {expenseTypes.map(t => {
          const IconComp = ICON_REGISTRY[t.icon]
          return (
            <div key={t.name} className="flex items-center gap-3">
              {IconComp && <IconComp style={{ color: t.color, fontSize: '20px', flexShrink: 0 }} />}
              <span className="flex-1 text-sm font-medium">{t.name}</span>
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>$</span>
                <Input
                  type="number"
                  placeholder="—"
                  value={limits[t.name] ?? ''}
                  onChange={e => handleChange(t.name, e.target.value)}
                  className="pl-7 text-right"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )
        })}
      </div>

      <ErrorMsg msg={error} />

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={loading} className="w-full font-semibold py-5">
          {loading ? 'Saving...' : 'Finish Setup'}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-sm bg-transparent border-none cursor-pointer font-[inherit] py-2 opacity-45"
          style={{ color: C.warmText }}
        >
          Skip this step
        </button>
      </div>
    </form>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const STEPS = ['income', 'budgets']

export default function BudgetSetup({ onComplete }) {
  const C = useC()
  const [phase, setPhase] = useState('welcome')

  async function skipAll() {
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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <Card
        variant="glass"
        blur="xl"
        className="w-full max-w-[480px] rounded-2xl p-6 sm:p-8"
      >
        {/* Step progress */}
        {isStep && (
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: C.dimText }}>
                Step {stepIndex + 1} of {STEPS.length}
              </span>
              <button
                type="button"
                onClick={skipAll}
                className="text-xs bg-transparent border-none cursor-pointer font-[inherit] opacity-40 p-0"
                style={{ color: C.warmText }}
              >
                Skip all
              </button>
            </div>
            <div className="h-[3px] rounded-full" style={{ backgroundColor: C.borderMed }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%`, backgroundColor: C.primary }}
              />
            </div>
          </div>
        )}

        {phase === 'welcome' && <WelcomeStep onStart={() => setPhase('income')} onSkip={skipAll} />}
        {phase === 'income' && <IncomeStep onNext={() => setPhase('budgets')} onSkip={() => setPhase('budgets')} />}
        {phase === 'budgets' && <BudgetLimitsStep onComplete={onComplete} onSkip={skipAll} />}
      </Card>
    </div>
  )
}
