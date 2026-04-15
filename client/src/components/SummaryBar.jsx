import { useEffect, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import AddIcon from '@mui/icons-material/Add'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import api from '../api.js'
import { ICON_REGISTRY } from '../expenseTypes.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import SpendingChart from './SpendingChart.jsx'
import AddIncomeForm from './AddIncomeForm.jsx'


const CARD_LIMIT = 9

export default function SummaryBar({ refreshKey, selectedMonth, activeType, onTypeChange, activeMacro, onMacroChange }) {
  const { typeMap } = useExpenseTypes()
  const [summary, setSummary] = useState([])
  const [budgets, setBudgets] = useState({})
  const [totalIncome, setTotalIncome] = useState(0)
  const [macroSummary, setMacroSummary] = useState([])
  const [pacing, setPacing] = useState({})
  const [isCurrentMonth, setIsCurrentMonth] = useState(true)
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [showAllCards, setShowAllCards] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(true)

  const fetchData = useCallback(() => {
    Promise.all([
      api.get('/expenses/summary', { params: { month: selectedMonth } }),
      api.get('/budgets/effective', { params: { month: selectedMonth } }),
      api.get('/incomes/summary', { params: { month: selectedMonth } }),
      api.get('/macrocategories/summary', { params: { month: selectedMonth } }),
      api.get('/analysis/pacing', { params: { month: selectedMonth, lookback_months: 3 } }),
    ]).then(([summaryRes, budgetsRes, incomeRes, macroRes, pacingRes]) => {
      setSummary(summaryRes.data)
      const budgetMap = {}
      budgetsRes.data.forEach(b => { budgetMap[b.type] = b.monthly_limit })
      setBudgets(budgetMap)
      setTotalIncome(incomeRes.data.total)
      setMacroSummary(macroRes.data)
      setPacing(Object.fromEntries((pacingRes.data.categories ?? []).map(c => [c.type, c])))
      setIsCurrentMonth(pacingRes.data.is_current_month ?? true)
    })
  }, [selectedMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData, refreshKey])

  const totalSpent = summary.reduce((sum, s) => sum + s.total, 0)
  const totalBudget = Object.values(budgets).reduce((sum, v) => sum + v, 0)
  const grandPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : null
  const grandOver = totalBudget > 0 && totalSpent > totalBudget
  const net = totalIncome - totalSpent
  const hasIncome = totalIncome > 0

  const totalProjected = isCurrentMonth
    ? Object.values(pacing).reduce((sum, p) => sum + (p.projected_spend ?? p.spent ?? 0), 0)
    : null
  const projectedOver = totalBudget > 0 && totalProjected != null && totalProjected > totalBudget

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid rgba(240, 234, 214, 0.12)',
        borderRadius: 2,
        p: { xs: 2, sm: 3 },
        mb: 3,
      }}
    >
      {/* Header row */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1 }}>
            ${totalSpent.toFixed(2)}
          </Typography>
          {totalBudget > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              of ${totalBudget.toFixed(2)} budget
            </Typography>
          )}
          {totalProjected != null && totalBudget > 0 && (
            <Typography variant="body2" sx={{ mt: 0.25, color: projectedOver ? 'error.main' : 'text.secondary' }}>
              ${totalProjected.toFixed(2)} projected
            </Typography>
          )}
        </Box>
        {totalBudget > 0 && (
          <Box sx={{ pt: 0.5, textAlign: 'right' }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, color: grandOver ? 'error.main' : 'primary.main', lineHeight: 1.2 }}
            >
              {grandOver
                ? `$${(totalSpent - totalBudget).toFixed(2)} over budget`
                : `$${(totalBudget - totalSpent).toFixed(2)} remaining`}
            </Typography>
            {totalProjected != null && (
              <Typography variant="body2" sx={{ mt: 0.25, color: projectedOver ? 'error.main' : 'text.secondary' }}>
                {projectedOver
                  ? `$${(totalProjected - totalBudget).toFixed(2)} proj. over`
                  : `$${(totalBudget - totalProjected).toFixed(2)} proj. remaining`}
              </Typography>
            )}
          </Box>
        )}
      </Stack>

      {/* Income / Net row */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap">
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
                    minWidth: { xs: 0, sm: 160 },
                    flex: { xs: '1 1 100%', sm: '1 1 160px' },
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
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setCategoriesOpen(o => !o)}
        sx={{ cursor: 'pointer', userSelect: 'none', mb: categoriesOpen ? 2 : 0 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
          Categories
        </Typography>
        <IconButton size="small" sx={{ color: 'text.secondary' }}>
          {categoriesOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Collapse in={categoriesOpen}>
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
                minWidth: { xs: 0, sm: 150 },
                flex: { xs: '1 1 100%', sm: '1 1 150px' },
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
                {/* Two-tone bar: solid = actual spend (category color), ghost extension = projection */}
                {pct !== null && (() => {
                  const pac = pacing[s.type]
                  const actuallyOver = limit > 0 && s.total > limit
                  const solidColor = actuallyOver ? '#e07c7c' : typeEntry.color
                  const statusColor = pac?.status === 'over_budget' ? '#e07c7c'
                    : pac?.status === 'at_risk' ? '#f0c040'
                    : typeEntry.color
                  const projPct = isCurrentMonth && pac?.projected_spend != null && pac.projected_spend > s.total && limit > 0
                    ? Math.min((pac.projected_spend / limit) * 100, 100)
                    : null
                  const ghostWidth = projPct !== null ? projPct - (pct ?? 0) : null
                  return (
                    <Box sx={{ position: 'relative', height: 4, borderRadius: 2, bgcolor: 'rgba(240,234,214,0.08)', mb: 0.75, overflow: 'hidden' }}>
                      {ghostWidth !== null && ghostWidth > 0 && (
                        <Box sx={{ position: 'absolute', top: 0, left: `${pct}%`, height: '100%', width: `${ghostWidth}%`, bgcolor: statusColor, opacity: 0.4, borderRadius: 2 }} />
                      )}
                      <Box sx={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, bgcolor: solidColor, borderRadius: 2 }} />
                    </Box>
                  )
                })()}
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    {s.count} {s.count === 1 ? 'expense' : 'expenses'}
                  </Typography>
                  {isCurrentMonth && pacing[s.type]?.status && pacing[s.type].status !== 'no_budget' ? (
                    <Chip
                      label={pacing[s.type].status === 'over_budget' ? `$${(pacing[s.type].projected_spend - limit).toFixed(0)} proj. over`
                        : pacing[s.type].status === 'at_risk' ? 'at risk'
                        : 'on track'}
                      size="small"
                      sx={{
                        fontSize: '0.72rem', height: 20, fontWeight: 600,
                        bgcolor: pacing[s.type].status === 'over_budget' ? '#e07c7c'
                          : pacing[s.type].status === 'at_risk' ? '#f0c040'
                          : '#8fb996',
                        color: '#22252e',
                      }}
                    />
                  ) : over ? (
                    <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                      ${(s.total - limit).toFixed(2)} over
                    </Typography>
                  ) : null}
                </Stack>
                {isCurrentMonth && pacing[s.type]?.projected_spend != null && (
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    → ${pacing[s.type].projected_spend.toFixed(2)} projected
                  </Typography>
                )}
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
              <Box
                onClick={() => setShowAllCards(v => !v)}
                sx={{ minHeight: 40, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                  {showAllCards ? 'Show less ↑' : `Show all ${summary.length} categories ↓`}
                </Typography>
              </Box>
            </Box>
          )}
        </Stack>

        <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 340 }, display: { xs: 'none', sm: 'block' } }}>
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
      </Collapse>

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
