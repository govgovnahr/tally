import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import api from '../api.js'
import { useC } from '../colors'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import MonthSelector from './MonthSelector.jsx'
import MonthlyTrendsChart from './MonthlyTrendsChart.jsx'
import SummaryBar from './SummaryBar.jsx'
import ExpenseList from './ExpenseList.jsx'
import OutlierAlert from './OutlierAlert.jsx'
import SpendingDonut from './SpendingDonut.jsx'
import SavingsGoalsMini from './SavingsGoalsMini.jsx'

function fmt(n) { return `$${n.toFixed(2)}` }

function KPICard({ label, value, subtitle, subtitle2, color, icon, progress, progressColor }) {
  const C = useC()
  return (
    <Paper elevation={0} sx={{ bgcolor: 'background.paper', borderRadius: 2, p: { xs: 1.75, sm: 2.5 } }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem', fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" gap={0.5} mt={0.5}>
        {icon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{icon}</Box>}
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, color: color ?? 'text.primary' }}>
          {value}
        </Typography>
      </Stack>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
          {subtitle}
        </Typography>
      )}
      {progress != null && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 3,
            borderRadius: 2,
            mt: 1,
            bgcolor: C.hoverStrong,
            '& .MuiLinearProgress-bar': { bgcolor: progressColor ?? C.primary, borderRadius: 2 },
          }}
        />
      )}
      {subtitle2 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {subtitle2}
        </Typography>
      )}
    </Paper>
  )
}

const LABEL_SX = {
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontSize: '0.75rem',
}

export default function DashboardPage({ selectedMonth, onMonthChange, refreshKey, onRefresh, onNavigate }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()
  const [summary, setSummary] = useState([])
  const [budgets, setBudgets] = useState({})
  const [totalIncome, setTotalIncome] = useState(0)
  const [outliers, setOutliers] = useState([])
  const [goals, setGoals] = useState([])
  const [pacingCats, setPacingCats] = useState([])
  const [isCurrentMonth, setIsCurrentMonth] = useState(true)
  const [activeType, setActiveType] = useState('All')
  const [activeMacro, setActiveMacro] = useState(null)

  const fetchData = useCallback(() => {
    Promise.all([
      api.get('/expenses/summary', { params: { month: selectedMonth } }),
      api.get('/budgets/effective', { params: { month: selectedMonth } }),
      api.get('/incomes/summary', { params: { month: selectedMonth } }),
      api.get('/analysis/outliers', { params: { months: 1 } }),
      api.get('/savings-goals'),
      api.get('/analysis/pacing', { params: { month: selectedMonth, lookback_months: 3 } }),
    ]).then(([summaryRes, budgetsRes, incomeRes, outliersRes, goalsRes, pacingRes]) => {
      setSummary(summaryRes.data)
      const budgetMap = {}
      budgetsRes.data.forEach(b => { budgetMap[b.type] = b.monthly_limit })
      setBudgets(budgetMap)
      setTotalIncome(incomeRes.data.total)
      setOutliers(outliersRes.data)
      setGoals(goalsRes.data)
      setPacingCats(pacingRes.data.categories ?? [])
      setIsCurrentMonth(pacingRes.data.is_current_month ?? false)
    })
  }, [selectedMonth])

  useEffect(() => { fetchData() }, [fetchData, refreshKey])

  const totalSpent = summary.reduce((s, x) => s + x.total, 0)
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0)
  const net = totalIncome - totalSpent
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : null
  const grandPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : null
  const totalProjected = isCurrentMonth
    ? pacingCats.reduce((s, c) => s + (c.projected_spend ?? c.spent ?? 0), 0)
    : null

  const spentColor = totalBudget > 0 && totalSpent > totalBudget ? C.overBudget : 'text.primary'
  const netColor = net >= 0 ? C.primary : C.overBudget
  const savingsColor = savingsRate == null ? 'text.secondary'
    : savingsRate >= 10 ? C.primary
    : savingsRate > 0 ? C.atRisk
    : C.overBudget
  const budgetBarColor = totalSpent > totalBudget ? C.overBudget
    : totalBudget > 0 && totalSpent / totalBudget > 0.85 ? C.atRisk
    : C.primary

  const activeGoals = goals.filter(g => !g.completed && !g.is_paused)
  const hasGoals = activeGoals.length > 0

  // Budget status rows: sort by pct used desc, show top N
  const budgetRows = [...pacingCats]
    .filter(c => c.spent > 0 || (c.budget_limit ?? 0) > 0)
    .sort((a, b) => {
      const pA = (a.budget_limit ?? 0) > 0 ? a.spent / a.budget_limit : a.spent / 1e9
      const pB = (b.budget_limit ?? 0) > 0 ? b.spent / b.budget_limit : b.spent / 1e9
      return pB - pA
    })
    .slice(0, hasGoals ? 4 : 7)

  const handleTypeChange = t => { setActiveType(t); setActiveMacro(null) }
  const handleMacroChange = m => { setActiveMacro(m); setActiveType('All') }

  const spentSubtitle = totalBudget > 0 ? `of ${fmt(totalBudget)} budget` : undefined
  const spentProjected = isCurrentMonth && totalProjected != null
    ? `→ ${fmt(totalProjected)} projected`
    : null

  return (
    <Box>
      <MonthSelector selectedMonth={selectedMonth} onMonthChange={onMonthChange} refreshKey={refreshKey} />

      {outliers.length > 0 && (
        <OutlierAlert count={outliers.length} onNavigate={onNavigate} />
      )}

      {/* KPI Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <KPICard
          label="Spent"
          value={fmt(totalSpent)}
          subtitle={spentSubtitle}
          subtitle2={spentProjected}
          color={spentColor}
          progress={grandPct}
          progressColor={budgetBarColor}
        />
        <KPICard
          label="Income"
          value={fmt(totalIncome)}
          color={totalIncome > 0 ? C.income : 'text.secondary'}
        />
        <KPICard
          label="Net"
          value={`${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}`}
          color={netColor}
          icon={net >= 0
            ? <TrendingUpIcon sx={{ fontSize: 18, color: netColor }} />
            : <TrendingDownIcon sx={{ fontSize: 18, color: netColor }} />}
        />
        <KPICard
          label="Savings Rate"
          value={savingsRate != null ? `${savingsRate.toFixed(0)}%` : '—'}
          subtitle={savingsRate != null ? 'of income saved' : 'add income to track'}
          color={savingsColor}
        />
      </Box>

      {/* Donut + Budget Status */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3, alignItems: 'start' }}>
        {/* Left: Spending Donut */}
        <Paper elevation={0} sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2.5 }}>
          <Typography variant="body2" sx={{ ...LABEL_SX, mb: 2 }}>Spending Breakdown</Typography>
          <SpendingDonut
            summary={summary}
            activeType={activeType}
            onTypeChange={handleTypeChange}
          />
        </Paper>

        {/* Right: [Goals if any] + Budget Status */}
        <Paper elevation={0} sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 2.5 }}>
          {hasGoals && (
            <>
              <Typography variant="body2" sx={{ ...LABEL_SX, mb: 2 }}>Savings Goals</Typography>
              <SavingsGoalsMini goals={goals} onNavigate={onNavigate} />
              <Divider sx={{ borderColor: C.hoverStrong, my: 2 }} />
            </>
          )}

          <Typography variant="body2" sx={{ ...LABEL_SX, mb: 1.5 }}>Budget Status</Typography>
          {budgetRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No budget data yet.</Typography>
          ) : (
            <Stack gap={1.25}>
              {budgetRows.map(cat => {
                const limit = cat.budget_limit ?? 0
                const spent = cat.spent ?? 0
                const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : null
                const typeEntry = typeMap[cat.type] ?? {}
                const catColor = typeEntry.color ?? C.dimText
                const barColor = cat.status === 'over_budget' ? C.overBudget
                  : cat.status === 'at_risk' ? C.atRisk
                  : catColor
                const statusLabel = cat.status === 'over_budget' ? 'over'
                  : cat.status === 'at_risk' ? 'at risk'
                  : cat.status === 'on_track' ? null
                  : null

                return (
                  <Box key={cat.type}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.4}>
                      <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: catColor, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat.type}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexShrink: 0, ml: 1 }}>
                        {statusLabel && (
                          <Chip
                            label={statusLabel}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              bgcolor: cat.status === 'over_budget' ? C.overBudget : C.atRisk,
                              color: C.surface,
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary">
                          ${spent.toFixed(0)}{limit > 0 ? ` / $${limit.toFixed(0)}` : ''}
                        </Typography>
                      </Stack>
                    </Stack>
                    {pct !== null && (
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 3,
                          borderRadius: 2,
                          bgcolor: C.hoverStrong,
                          '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 2 },
                        }}
                      />
                    )}
                    {isCurrentMonth && cat.projected_spend != null && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                        → {fmt(cat.projected_spend)} projected
                      </Typography>
                    )}
                  </Box>
                )
              })}
            </Stack>
          )}
        </Paper>
      </Box>

      {/* Category detail — collapsed by default */}
      <SummaryBar
        refreshKey={refreshKey}
        selectedMonth={selectedMonth}
        activeType={activeType}
        onTypeChange={handleTypeChange}
        activeMacro={activeMacro}
        onMacroChange={handleMacroChange}
        hideHeader
        defaultCollapsed
      />

      {/* Monthly Trends */}
      <MonthlyTrendsChart
        refreshKey={refreshKey}
        selectedMonth={selectedMonth}
        activeType={activeType}
        onTypeChange={handleTypeChange}
        activeMacro={activeMacro}
        onMacroChange={handleMacroChange}
      />

      {/* Expense List for current month */}
      <ExpenseList
        refreshKey={refreshKey}
        onRefresh={onRefresh}
        month={selectedMonth}
        activeType={activeType}
        onTypeChange={handleTypeChange}
        activeMacro={activeMacro}
        onMacroChange={handleMacroChange}
      />

    </Box>
  )
}
