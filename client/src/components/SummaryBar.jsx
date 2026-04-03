import { useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AddIcon from '@mui/icons-material/Add'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import api from '../api.js'
import { ICON_REGISTRY } from '../expenseTypes.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import SpendingChart from './SpendingChart.jsx'
import AddIncomeForm from './AddIncomeForm.jsx'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

const CARD_LIMIT = 9

export default function SummaryBar({ refreshKey, selectedMonth, onMonthChange, activeType, onTypeChange, activeMacro, onMacroChange }) {
  const { typeMap } = useExpenseTypes()
  const [summary, setSummary] = useState([])
  const [budgets, setBudgets] = useState({})
  const [availableMonths, setAvailableMonths] = useState([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [macroSummary, setMacroSummary] = useState([])
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [showAllCards, setShowAllCards] = useState(false)

  const fetchData = useCallback(() => {
    Promise.all([
      api.get('/expenses/summary', { params: { month: selectedMonth } }),
      api.get('/budgets/effective', { params: { month: selectedMonth } }),
      api.get('/expenses/months'),
      api.get('/incomes/summary', { params: { month: selectedMonth } }),
      api.get('/macrocategories/summary', { params: { month: selectedMonth } }),
    ]).then(([summaryRes, budgetsRes, monthsRes, incomeRes, macroRes]) => {
      setSummary(summaryRes.data)
      const budgetMap = {}
      budgetsRes.data.forEach(b => { budgetMap[b.type] = b.monthly_limit })
      setBudgets(budgetMap)
      const now = currentMonth()
      const months = monthsRes.data.includes(now) ? monthsRes.data : [...monthsRes.data, now].sort()
      setAvailableMonths(months)
      setTotalIncome(incomeRes.data.total)
      setMacroSummary(macroRes.data)
    })
  }, [selectedMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const idx = availableMonths.indexOf(selectedMonth)
  const hasPrev = idx > 0
  const hasNext = idx !== -1 && idx < availableMonths.length - 1

  const totalSpent = summary.reduce((sum, s) => sum + s.total, 0)
  const totalBudget = Object.values(budgets).reduce((sum, v) => sum + v, 0)
  const grandPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : null
  const grandOver = totalBudget > 0 && totalSpent > totalBudget
  const net = totalIncome - totalSpent
  const hasIncome = totalIncome > 0

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid rgba(240, 234, 214, 0.12)',
        borderRadius: 2,
        p: 3,
        mb: 3,
      }}
    >
      {/* Header row */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Box>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 0.5 }}>
            <IconButton
              size="small"
              onClick={() => onMonthChange(availableMonths[idx - 1])}
              disabled={!hasPrev}
              sx={{ color: 'text.secondary', p: 0.25, '&:hover': { color: 'text.primary' }, '&.Mui-disabled': { opacity: 0.2 } }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {formatMonthLabel(selectedMonth)}
            </Typography>
            {selectedMonth > currentMonth() && (
              <Typography
                variant="caption"
                sx={{
                  px: 0.75, py: 0.1,
                  bgcolor: 'rgba(240,234,214,0.08)',
                  border: '1px solid rgba(240,234,214,0.15)',
                  borderRadius: 1,
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                  letterSpacing: '0.04em',
                }}
              >
                projection
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={() => onMonthChange(availableMonths[idx + 1])}
              disabled={!hasNext}
              sx={{ color: 'text.secondary', p: 0.25, '&:hover': { color: 'text.primary' }, '&.Mui-disabled': { opacity: 0.2 } }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1 }}>
            ${totalSpent.toFixed(2)}
          </Typography>
          {totalBudget > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              of ${totalBudget.toFixed(2)} budget
            </Typography>
          )}
        </Box>
        {grandPct !== null && (
          <Box sx={{ width: 200, pt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={grandPct}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(240,234,214,0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: grandOver ? 'error.main' : 'primary.main',
                  borderRadius: 4,
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{
                mt: 0.5,
                display: 'block',
                textAlign: 'right',
                color: grandOver ? 'error.main' : 'text.secondary',
              }}
            >
              {grandOver ? 'Over budget' : `${Math.round(grandPct)}%`}
            </Typography>
          </Box>
        )}
      </Stack>

      {/* Income / Net row */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Stack direction="row" gap={3} flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">Income</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: hasIncome ? '#80cbc4' : 'text.secondary' }}>
              ${totalIncome.toFixed(2)}
            </Typography>
          </Box>
          {hasIncome && (
            <Box>
              <Typography variant="caption" color="text.secondary">Net</Typography>
              <Stack direction="row" alignItems="center" gap={0.5}>
                {net >= 0
                  ? <TrendingUpIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  : <TrendingDownIcon sx={{ fontSize: 16, color: 'error.main' }} />
                }
                <Typography
                  variant="body1"
                  sx={{ fontWeight: 600, color: net >= 0 ? 'primary.main' : 'error.main' }}
                >
                  {net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(2)}
                </Typography>
              </Stack>
            </Box>
          )}
        </Stack>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => { setEditingIncome(null); setShowIncomeForm(true) }}
          sx={{ fontWeight: 600, flexShrink: 0, borderColor: '#80cbc4', color: '#80cbc4',
            '&:hover': { borderColor: '#80cbc4', bgcolor: 'rgba(128,203,196,0.08)' } }}
        >
          Add Income
        </Button>
      </Stack>

      <Divider sx={{ borderColor: 'rgba(240,234,214,0.08)', mb: 3 }} />

      {/* Macrocategory summary cards */}
      {macroSummary.length > 0 && (
        <>
          <Stack direction="row" flexWrap="wrap" gap={2} mb={2}>
            {macroSummary.map(m => {
              const isSelected = activeMacro === m.id
              const hasBudget = m.budget_limit > 0
              const over = hasBudget && m.total > m.budget_limit
              const pct = hasBudget ? Math.min((m.total / m.budget_limit) * 100, 100) : null
              return (
                <Card
                  key={m.id}
                  elevation={0}
                  onClick={() => onMacroChange?.(isSelected ? null : m.id)}
                  sx={{
                    bgcolor: isSelected ? 'rgba(240,234,214,0.06)' : '#2c2f3a',
                    border: isSelected ? `1px solid ${m.color}` : '1px solid rgba(240,234,214,0.1)',
                    borderTop: `3px solid ${m.color}`,
                    borderRadius: 2,
                    minWidth: 160,
                    flex: '1 1 160px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, border-color 0.15s',
                    '&:hover': { bgcolor: 'rgba(240,234,214,0.06)' },
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {m.name}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: over ? 'error.main' : m.color, lineHeight: 1.2, mb: 0.5 }}>
                      ${m.total.toFixed(2)}
                      {hasBudget && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
                          {' '}/ ${m.budget_limit.toFixed(0)}
                        </Typography>
                      )}
                    </Typography>
                    {pct !== null && (
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 4, borderRadius: 2, mb: 0.75,
                          bgcolor: 'rgba(240,234,214,0.08)',
                          '& .MuiLinearProgress-bar': { bgcolor: over ? 'error.main' : m.color, borderRadius: 2 },
                        }}
                      />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {m.count} {m.count === 1 ? 'expense' : 'expenses'}
                    </Typography>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
          <Divider sx={{ borderColor: 'rgba(240,234,214,0.08)', mb: 3 }} />
        </>
      )}

      {/* Category cards + chart */}
      <Stack direction="row" alignItems="flex-start" gap={3} flexWrap="wrap">
        <Stack direction="row" flexWrap="wrap" gap={2} sx={{ flex: 1, minWidth: 280 }}>
        {[...summary].filter(s => !activeMacro || typeMap[s.type]?.macrocategory_id === activeMacro).sort((a, b) => {
          const pctA = budgets[a.type] > 0 ? a.total / budgets[a.type] : -1
          const pctB = budgets[b.type] > 0 ? b.total / budgets[b.type] : -1
          return pctB - pctA
        }).slice(0, (showAllCards || activeMacro) ? undefined : CARD_LIMIT).map(s => {
          const typeEntry = typeMap[s.type] || { color: '#a0a0a0', icon: null }
          const IconComp = typeEntry.icon ? ICON_REGISTRY[typeEntry.icon] : null
          const limit = budgets[s.type]
          const pct = limit > 0 ? Math.min((s.total / limit) * 100, 100) : null
          const over = limit > 0 && s.total > limit
          const isSelected = activeType === s.type

          return (
            <Card
              key={s.type}
              elevation={0}
              onClick={() => onTypeChange?.(isSelected ? 'All' : s.type)}
              sx={{
                bgcolor: isSelected ? 'rgba(240,234,214,0.06)' : '#2c2f3a',
                border: isSelected
                  ? `1px solid ${typeEntry.color}`
                  : '1px solid rgba(240, 234, 214, 0.1)',
                borderTop: `3px solid ${typeEntry.color}`,
                borderRadius: 2,
                minWidth: 150,
                flex: '1 1 150px',
                cursor: onTypeChange ? 'pointer' : 'default',
                transition: 'background-color 0.15s, border-color 0.15s',
                '&:hover': onTypeChange ? { bgcolor: 'rgba(240,234,214,0.06)' } : {},
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                  {IconComp && (
                    <IconComp sx={{ fontSize: 18, color: typeEntry.color }} />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {s.type}
                  </Typography>
                </Stack>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: over ? 'error.main' : typeEntry.color,
                    lineHeight: 1.2,
                    mb: 0.5,
                  }}
                >
                  ${s.total.toFixed(2)}
                  {limit > 0 && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 400 }}
                    >
                      {' '}/ ${limit.toFixed(0)}
                    </Typography>
                  )}
                </Typography>
                {pct !== null && (
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      mb: 0.75,
                      bgcolor: 'rgba(240,234,214,0.08)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: over ? 'error.main' : typeEntry.color,
                        borderRadius: 2,
                      },
                    }}
                  />
                )}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {s.count} {s.count === 1 ? 'expense' : 'expenses'}
                  </Typography>
                  {over && (
                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                      ${(s.total - limit).toFixed(2)} over
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )
        })}
          {summary.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              No expenses this month yet. Add one below!
            </Typography>
          )}
          {summary.length > CARD_LIMIT && (
            <Box sx={{ width: '100%' }}>
              <Typography
                variant="caption"
                onClick={() => setShowAllCards(v => !v)}
                sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'text.primary' } }}
              >
                {showAllCards ? 'Show less ↑' : `Show all ${summary.length} categories ↓`}
              </Typography>
            </Box>
          )}
        </Stack>

        <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 340 } }}>
          <SpendingChart
            summary={[...summary].filter(s => !activeMacro || typeMap[s.type]?.macrocategory_id === activeMacro).sort((a, b) => {
              const pctA = budgets[a.type] > 0 ? a.total / budgets[a.type] : -1
              const pctB = budgets[b.type] > 0 ? b.total / budgets[b.type] : -1
              return pctB - pctA
            }).slice(0, (showAllCards || activeMacro) ? undefined : CARD_LIMIT)}
            budgets={budgets}
          />
        </Box>
      </Stack>

      {showIncomeForm && (
        <AddIncomeForm
          onClose={() => setShowIncomeForm(false)}
          onAdded={() => { setShowIncomeForm(false); fetchData() }}
        />
      )}
      {editingIncome && (
        <AddIncomeForm
          income={editingIncome}
          onClose={() => setEditingIncome(null)}
          onAdded={() => { setEditingIncome(null); fetchData() }}
        />
      )}
    </Paper>
  )
}
