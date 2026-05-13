import { useState, startTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../api.js'
import { qk } from '../../queryKeys.js'
import { useC } from '../../colors'
import { Card } from 'glasscn-ui'
import { useExpenseTypes } from '../../ExpenseTypesContext.jsx'
import MonthSelector from '../inputs/MonthSelector.jsx'
import MonthlyTrendsChart from '../charts/MonthlyTrendsChart.jsx'
import SummaryBar from '../widgets/SummaryBar.jsx'
import ExpenseList from './ExpenseList.jsx'
import OutlierAlert from '../charts/OutlierAlert.jsx'
import SpendingDonut from '../charts/SpendingDonut.jsx'
import SavingsGoalsMini from '../widgets/SavingsGoalsMini.jsx'
import ColorDot from '../ui/ColorDot.jsx'

function fmt(n) { return `$${n.toFixed(2)}` }

function KPICard({ label, value, subtitle, subtitleColor, subtitle2, color, progress, progressColor }) {
  const C = useC()
  return (
    <Card className='rounded-xl p-3.5 sm:p-5' style={{ minHeight: '6rem' }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: C.muted }}>
        {label}
      </p>
      <p className="text-xl font-bold leading-tight" style={{ color: color ?? C.warmText }}>
        {value}
      </p>
      <p className="text-sm mt-0.5" style={{ color: subtitleColor ?? C.muted, visibility: subtitle ? 'visible' : 'hidden' }}>
        {subtitle ?? ' '}
      </p>
      {progress != null && (
        <div className="h-[3px] rounded-full mt-2.5" style={{ backgroundColor: C.hoverStrong }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: progressColor ?? C.primary }} />
        </div>
      )}
      <p className="text-xs mt-1" style={{ color: C.muted, visibility: subtitle2 ? 'visible' : 'hidden' }}>
        {subtitle2 ?? ' '}
      </p>
    </Card>
  )
}

export default function DashboardPage({ selectedMonth, onMonthChange, onNavigate }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()
  const [activeType, setActiveType] = useState('All')
  const [activeMacro, setActiveMacro] = useState(null)

  const { data: outliersData = [] } = useQuery({
    queryKey: qk.analysisOutliers(12),
    queryFn: () => api.get('/analysis/outliers', { params: { months: 12 } }).then(r => r.data),
    staleTime: 3 * 60_000,
  })
  const outliers = outliersData.filter(e => e.date.startsWith(selectedMonth))

  const { data: goals = [] } = useQuery({
    queryKey: qk.savingsGoals(),
    queryFn: () => api.get('/savings-goals').then(r => r.data),
    staleTime: 3 * 60_000,
  })

  const { data: summary = [] } = useQuery({
    queryKey: qk.expensesSummary(selectedMonth),
    queryFn: () => api.get('/expenses/summary', { params: { month: selectedMonth } }).then(r => r.data),
    staleTime: 60_000,
  })

  const { data: budgetsEffective = [] } = useQuery({
    queryKey: qk.budgetsEffective(selectedMonth),
    queryFn: () => api.get('/budgets/effective', { params: { month: selectedMonth } }).then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const budgets = Object.fromEntries(budgetsEffective.map(b => [b.type, b.monthly_limit]))

  const { data: incomeSummary } = useQuery({
    queryKey: qk.incomesSummary(selectedMonth),
    queryFn: () => api.get('/incomes/summary', { params: { month: selectedMonth } }).then(r => r.data),
    staleTime: 60_000,
  })
  const totalIncome = incomeSummary?.total ?? 0

  const { data: pacingData } = useQuery({
    queryKey: qk.analysisPacing(selectedMonth, 3),
    queryFn: () => api.get('/analysis/pacing', { params: { month: selectedMonth, lookback_months: 3 } }).then(r => r.data),
    staleTime: 3 * 60_000,
  })
  const pacingCats = pacingData?.categories ?? []
  const isCurrentMonth = pacingData?.is_current_month ?? true

  const { data: macroSummary = [] } = useQuery({
    queryKey: qk.macrocategoriesSummary(selectedMonth),
    queryFn: () => api.get('/macrocategories/summary', { params: { month: selectedMonth } }).then(r => r.data),
    staleTime: 60_000,
  })

  const totalSpent = summary.reduce((s, x) => s + x.total, 0)
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0)
  const net = totalIncome - totalSpent
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : null
  const grandPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : null
  const totalProjected = isCurrentMonth
    ? pacingCats.reduce((s, c) => s + (c.projected_spend ?? c.spent ?? 0), 0)
    : null

  const [yr, mo] = selectedMonth.split('-').map(Number)
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const daysElapsed = isCurrentMonth ? Math.max(new Date().getDate(), 1) : daysInMonth
  const dailyRate = daysElapsed > 0 ? totalSpent / daysElapsed : 0
  const targetDailyRate = totalBudget > 0 ? totalBudget / daysInMonth : null

  const needsAttention = pacingCats
    .filter(c => c.status === 'over_budget' || (isCurrentMonth && c.status === 'at_risk'))
    .sort((a, b) => {
      if (a.status === 'over_budget' && b.status !== 'over_budget') return -1
      if (b.status === 'over_budget' && a.status !== 'over_budget') return 1
      return (b.spent / (b.budget_limit || 1)) - (a.spent / (a.budget_limit || 1))
    })

  const spentColor = (() => {
    if (totalBudget === 0) return C.warmText
    const proj = isCurrentMonth && totalProjected != null ? totalProjected : totalSpent
    const ratio = proj / totalBudget
    if (ratio > 1)    return C.overBudget
    if (ratio > 0.90) return C.atRisk
    if (ratio > 0.75) return C.nearGoal
    return C.onTrack
  })()
  const netColor = net >= 0 ? C.primary : C.overBudget
  const savingsColor = savingsRate == null ? C.muted
    : savingsRate >= 10 ? C.primary
    : savingsRate > 0 ? C.atRisk
    : C.overBudget
  const budgetBarColor = totalSpent > totalBudget ? C.overBudget
    : totalBudget > 0 && totalSpent / totalBudget > 0.85 ? C.atRisk
    : C.primary
  const rateColor = dailyRate == null || targetDailyRate == null ? C.muted
    : dailyRate >= targetDailyRate ? C.overBudget
    : C.primary

  const activeGoals = goals.filter(g => !g.completed && !g.is_paused)
  const hasGoals = activeGoals.length > 0

  const handleTypeChange = t => startTransition(() => { setActiveType(t); setActiveMacro(null) })
  const handleMacroChange = m => startTransition(() => { setActiveMacro(m); setActiveType('All') })

  const spentSubtitle = totalBudget > 0 ? `of ${fmt(totalBudget)} budget` : undefined
  const spentProjected = isCurrentMonth && totalProjected != null
    ? `→ ${fmt(totalProjected)} projected`
    : null

  return (
    <div>
      <MonthSelector selectedMonth={selectedMonth} onMonthChange={onMonthChange} big={true} />

      {outliers.length > 0 && (
        <OutlierAlert
          count={outliers.length}
          onSeeDetails={() => onNavigate('analysis', { outlierMonth: selectedMonth })}
        />
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4" data-tour="summary-bar">
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
          label="Income / Net"
          value={fmt(totalIncome)}
          color={totalIncome > 0 ? C.income : C.muted}
          subtitle={totalIncome > 0 ? `Net ${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}` : 'add income to track'}
          subtitleColor={totalIncome > 0 ? netColor : undefined}
        />
        <KPICard
          label="Burn Rate"
          value={dailyRate != null ? `$${dailyRate.toFixed(2)}/day` : '—'}
          subtitle={targetDailyRate != null ? `Target: $${targetDailyRate.toFixed(2)}/day` : '-'}
          subtitleColor={budgetBarColor}
          color={rateColor}
        />
        <KPICard
          label="Savings Rate"
          value={savingsRate != null ? `${savingsRate.toFixed(0)}%` : '—'}
          subtitle={savingsRate != null ? 'of income saved' : 'add income to track'}
          color={savingsColor}
        />
      </div>

      {/* Donut + Budget Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 items-start">
        {/* Left: Spending Donut */}
        <Card className="rounded-xl p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: C.muted }}>
            Spending Breakdown
          </p>
          <SpendingDonut
            summary={summary}
            activeType={activeType}
            onTypeChange={handleTypeChange}
          />
        </Card>

        {/* Right: Goals + Budget Status */}
        <Card className="rounded-xl p-4 sm:p-5">
          {hasGoals && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: C.muted }}>
                Savings Goals
              </p>
              <SavingsGoalsMini goals={goals} onNavigate={onNavigate} />
              <div className="h-px my-4" style={{ backgroundColor: C.hoverStrong }} />
            </>
          )}

          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: C.muted }}>
            {isCurrentMonth ? 'Needs Attention' : 'Over Budget'}
          </p>
          {needsAttention.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>
              {pacingCats.length === 0 ? 'No budget data yet.' : 'All categories on track.'}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {needsAttention.map(cat => {
                const limit = cat.budget_limit ?? 0
                const spent = cat.spent ?? 0
                const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : null
                const typeEntry = typeMap[cat.type] ?? {}
                const catColor = typeEntry.color ?? C.dimText
                const barColor = cat.status === 'over_budget' ? C.overBudget : C.atRisk
                const overBy = limit > 0 ? spent - limit : 0
                const statusLabel = cat.status === 'at_risk' ? 'at risk'
                  : !isCurrentMonth ? `+${fmt(overBy)} over`
                  : 'proj. over'

                return (
                  <div key={cat.type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ColorDot color={catColor} />
                        <span className="text-sm font-medium truncate" style={{ color: C.warmText }}>{cat.type}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span
                          className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: barColor, color: '#fff' }}
                        >
                          {statusLabel}
                        </span>
                        <span className="text-xs" style={{ color: C.muted }}>
                          ${spent.toFixed(0)}{limit > 0 ? ` / $${limit.toFixed(0)}` : ''}
                        </span>
                      </div>
                    </div>
                    {pct !== null && (
                      <div className="h-[3px] rounded-full" style={{ backgroundColor: C.hoverStrong }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                    )}
                    {isCurrentMonth && cat.projected_spend != null && (
                      <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                        → {fmt(cat.projected_spend)} projected
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Category detail — collapsed by default */}
      <SummaryBar
        summary={summary}
        budgets={budgets}
        totalIncome={totalIncome}
        macroSummary={macroSummary}
        pacingCats={pacingCats}
        isCurrentMonth={isCurrentMonth}
        activeType={activeType}
        onTypeChange={handleTypeChange}
        activeMacro={activeMacro}
        onMacroChange={handleMacroChange}
        hideHeader
        defaultCollapsed
      />

      {/* Monthly Trends */}
      <MonthlyTrendsChart
        selectedMonth={selectedMonth}
        activeType={activeType}
        onTypeChange={handleTypeChange}
        activeMacro={activeMacro}
        onMacroChange={handleMacroChange}
      />

      {/* Expense List for current month */}
      <ExpenseList
        month={selectedMonth}
        activeType={activeType}
        onTypeChange={handleTypeChange}
        activeMacro={activeMacro}
        onMacroChange={handleMacroChange}
      />
    </div>
  )
}
