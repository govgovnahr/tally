import { useEffect, useRef, useState } from 'react'
import { startTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import { qk } from '../../queryKeys.js'
import { TrendingUp, TrendingDown, Minus, TriangleAlert, ArrowUp, ArrowDown, X, Sparkles, Loader2 } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
  Cell
} from 'recharts'
import api from '../../api.js'
import { useExpenseTypes } from '../../ExpenseTypesContext.jsx'
import { ICON_REGISTRY } from '../../expenseTypes.js'
import MonthSelector from '../inputs/MonthSelector.jsx'
import { useC } from '../../colors'
import AddExpenseForm from '../widgets/AddExpenseForm.jsx'
import { Card } from 'glasscn-ui'
import MonthSlider from '../inputs/MonthSlider.jsx'
import { ExpandableCard } from '../ui/expandable-card.jsx'
import CategoryAnalysisDialog from '../dialogs/CategoryAnalysisDialog.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import { currentMonth } from '../../lib/budgetMonths.js'
import { formatShortDate, formatMonthLabel } from '../../lib/format.js'

function shortMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' })
}

function monthsFromNow(ym) {
  const [y, m] = ym.split('-').map(Number)
  const now = new Date()
  return Math.max(1, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) + 1)
}


function useStatusColors() {
  const C = useC()
  return {
    well_under:  C.nearGoal,
    on_track:    C.onTrack,
    at_risk:     C.atRisk,
    over_budget: C.overBudget,
    no_budget:   C.noBudget,
  }
}



function ShowMoreToggle({ shown, total, label, onToggle }) {
  const C = useC()
  function handleClick() {
    if (document.startViewTransition) document.startViewTransition(() => startTransition(onToggle))
    else startTransition(onToggle)
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="min-h-[40px] flex items-center text-sm bg-transparent border-none cursor-pointer font-[inherit]"
      style={{ color: C.muted }}
    >
      {shown ? 'Show less ↑' : `Show all ${total} ${label} ↓`}
    </button>
  )
}

// ─── Pacing Section ───────────────────────────────────────────────────────────

function PacingSection({ month, onMonthChange, maxMonths = 12 }) {
  const C = useC()
  const STATUS_COLORS = useStatusColors()
  const { typeMap } = useExpenseTypes()
  const [lookbackMonths, setLookbackMonths] = useState(3)
  const [showAllPacing, setShowAllPacing] = useState(false)

  const { data } = useQuery({
    queryKey: qk.analysisPacing(month, lookbackMonths),
    queryFn: () => api.get('/analysis/pacing', { params: { month, lookback_months: lookbackMonths } }).then(r => r.data),
    staleTime: 3 * 60_000,
  })

  const isFuture = data && data.days_elapsed === 0 && !data.is_current_month
  const isPast = data && !data.is_current_month && !isFuture

  return (
    <Card className="rounded-xl p-4 sm:p-6" data-tour="pacing-section">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: C.warmText }}>Budget Pacing</h2>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            {isPast
              ? 'Actual spend vs budget for this month'
              : 'Projected end-of-month spend using historical daily rate'}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {data && !isFuture && (
            <span className="text-sm" style={{ color: C.muted }}>
              Day {data.days_elapsed} of {data.days_in_month}
            </span>
          )}
          {!isPast && (
            <div className="flex items-center gap-2" style={{ minWidth: 220 }}>
              <span className="text-sm flex-shrink-0" style={{ color: C.muted }}>History:</span>
              <MonthSlider value={lookbackMonths} onChange={setLookbackMonths} min={1} max={maxMonths} />
            </div>
          )}
        </div>
      </div>

      <MonthSelector selectedMonth={month} onMonthChange={onMonthChange} big={false} />

      {isFuture ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>Select a past or current month to see pacing.</p>
      ) : !data ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>Loading…</p>
      ) : data.categories.length === 0 ? (
        <p className="text-sm py-4" style={{ color: C.muted }}>No expenses recorded for this month.</p>
      ) : (
        <div className="flex flex-col gap-5 mt-4">
          {[...data.categories]
            .filter(c => c.spent > 0 || c.projected_spend != null)
            .sort((a, b) => {
              const order = { over_budget: 0, at_risk: 1, on_track: 2, well_under: 3, no_budget: 4 }
              return (order[a.status] ?? 4) - (order[b.status] ?? 4)
            })
            .slice(0, showAllPacing ? undefined : 3)
            .map(cat => {
              const typeEntry = typeMap[cat.type] || { color: C.dimText, icon: null }
              const IconComp = typeEntry.icon ? ICON_REGISTRY[typeEntry.icon] : null
              const catColor = C.adaptColor(typeEntry.color)
              const statusColor = STATUS_COLORS[cat.status]
              const actuallyOver = cat.budget_limit && cat.spent > cat.budget_limit
              const spentPct = cat.budget_limit
                ? Math.min((cat.spent / cat.budget_limit) * 100, 100)
                : null
              const projPct = !isPast && cat.budget_limit && cat.projected_spend != null && cat.projected_spend > cat.spent
                ? Math.min((cat.projected_spend / cat.budget_limit) * 100, 100)
                : null
              const ghostWidth = projPct !== null && spentPct !== null ? projPct - spentPct : null

              return (
                <div key={cat.type} style={{ viewTransitionName: `vt-pacing-${cat.type.replace(/[^a-zA-Z0-9]/g, '-')}` }}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {IconComp && <IconComp style={{ fontSize: 18, color: catColor }} />}
                      <span className="text-sm font-medium" style={{ color: C.warmText }}>{cat.type}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm" style={{ color: C.muted }}>
                        <strong style={{ color: C.warmText }}>${cat.spent.toFixed(2)}</strong> spent
                        {!isPast && cat.projected_spend != null && (
                          <> · <strong style={{ color: C.warmText }}>${cat.projected_spend.toFixed(2)}</strong> projected</>
                        )}
                        {cat.budget_limit ? ` / $${cat.budget_limit.toFixed(0)} budget` : ''}
                      </span>
                      {!isPast && cat.status !== 'no_budget' && (
                        <StatusBadge status={cat.status} />
                      )}
                    </div>
                  </div>
                  <div className="relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.hoverStrong }}>
                    {ghostWidth !== null && ghostWidth > 0 && (
                      <div
                        className="absolute top-0 h-full rounded-full"
                        style={{ left: `${spentPct}%`, width: `${ghostWidth}%`, backgroundColor: statusColor, opacity: 0.4 }}
                      />
                    )}
                    {spentPct !== null && (
                      <div
                        className="absolute top-0 left-0 h-full rounded-full"
                        style={{ width: `${spentPct}%`, backgroundColor: actuallyOver ? C.overBudget : catColor }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          {(() => {
            const total = data.categories.filter(c => c.spent > 0 || c.projected_spend != null).length
            return total > 3 ? (
              <ShowMoreToggle shown={showAllPacing} total={total} label="categories" onToggle={() => setShowAllPacing(v => !v)} />
            ) : null
          })()}
        </div>
      )}
    </Card>
  )
}

// ─── Budget Performance Section ───────────────────────────────────────────────

function BudgetPerformanceSection({ months }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()
  const [showAllOffenders, setShowAllOffenders] = useState(false)
  const [analysisCategory, setAnalysisCategory] = useState(null)

  const TREND_ICON = {
    up:   <TrendingUp size={16} style={{ color: C.trendUp }} />,
    down: <TrendingDown size={16} style={{ color: C.trendDown }} />,
    flat: <Minus size={16} style={{ color: C.dimText }} />,
  }

  const { data = [] } = useQuery({
    queryKey: qk.analysisCategoryStats(months, false),
    queryFn: () => api.get('/analysis/category-stats', { params: { months } }).then(r => r.data),
    staleTime: 3 * 60_000,
  })

  const chartData = [...data]
    .sort((a, b) => b.avg_monthly - a.avg_monthly)
    .slice(0, 10)
    .map(d => ({ type: d.type, avg: d.avg_monthly, budget: d.budget_limit ?? null }))

  const offenders = data.filter(d => d.months_over > 0 && d.budget_limit)

  return (
    <>
    <Card className="rounded-xl p-4 sm:p-6 mt-4">
      <h2 className="text-base sm:text-lg font-semibold mb-0.5" style={{ color: C.warmText }}>Budget Performance</h2>
      <p className="text-sm mb-5" style={{ color: C.muted }}>Average monthly spend vs budget over the selected period</p>

      {data.length === 0 ? (
        <p className="text-sm" style={{ color: C.muted }}>No expense data.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 30)}>
            <ComposedChart data={chartData} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.dimText, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <YAxis type="category" dataKey="type" tick={{ fill: C.tickLight, fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }}
                labelStyle={{ color: C.warmText }}
                formatter={(val, name) => [`$${Number(val).toFixed(2)}`, name]}
              />
              <Bar dataKey="avg" name="Avg spend" fill={C.spent} radius={[0, 3, 3, 0]} barSize={12} />
              <Bar dataKey="budget" name="Budget" fill={C.border} radius={[0, 3, 3, 0]} barSize={12} />
            </ComposedChart>
          </ResponsiveContainer>

          {offenders.length > 0 && (
            <>
              <div className="h-px my-5" style={{ backgroundColor: C.hoverStrong }} />
              <h3 className="text-sm font-semibold mb-3" style={{ color: C.warmText }}>Most often over budget</h3>
              <div className="flex flex-col gap-3">
                {(showAllOffenders ? offenders : offenders.slice(0, 3)).map(d => {
                  const typeEntry = typeMap[d.type] || { color: C.dimText, icon: null }
                  const IconComp = typeEntry.icon ? ICON_REGISTRY[typeEntry.icon] : null
                  const catColor = C.adaptColor(typeEntry.color)
                  const freqColor = d.frequency_pct >= 66 ? C.overBudget : d.frequency_pct >= 33 ? C.atRisk : C.onTrack
                  return (
                    <div
                      key={d.type}
                      className="px-4 py-3 rounded-xl cursor-pointer transition-colors duration-150"
                      style={{ backgroundColor: C.subtleBg, border: `1px solid ${C.border}` }}
                      onClick={() => setAnalysisCategory({ name: d.type, color: typeEntry.color, icon: typeEntry.icon })}
                      onMouseEnter={ev => { ev.currentTarget.style.backgroundColor = `${catColor}18`; ev.currentTarget.style.borderColor = C.borderMed }}
                      onMouseLeave={ev => { ev.currentTarget.style.backgroundColor = C.subtleBg; ev.currentTarget.style.borderColor = C.border }}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {IconComp && <IconComp style={{ fontSize: 18, color: catColor }} />}
                          <span className="text-sm font-medium" style={{ color: C.warmText }}>{d.type}</span>
                          {TREND_ICON[d.trend]}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm" style={{ color: C.muted }}>{d.months_over}/{d.months_total} months over</span>
                          <span className="text-sm font-semibold" style={{ color: C.overBudget }}>+${d.avg_overage.toFixed(0)} avg</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ backgroundColor: C.hoverStrong }}>
                        <div className="h-full rounded-full" style={{ width: `${d.frequency_pct}%`, backgroundColor: freqColor }} />
                      </div>
                    </div>
                  )
                })}
                {offenders.length > 3 && (
                  <ShowMoreToggle shown={showAllOffenders} total={offenders.length} label="offenders" onToggle={() => setShowAllOffenders(v => !v)} />
                )}
              </div>
            </>
          )}
        </>
      )}
    </Card>
    {analysisCategory && (
      <CategoryAnalysisDialog
        typeName={analysisCategory.name}
        typeColor={analysisCategory.color}
        typeIcon={analysisCategory.icon}
        onClose={() => setAnalysisCategory(null)}
      />
    )}
  </>
  )
}

// ─── Outlier Expanded Content ─────────────────────────────────────────────────

function OutlierExpandedContent({ expense, onEdit, onDismiss, onShowInExpenses, onClose, aiEnabled }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()

  const [explainRequested, setExplainRequested] = useState(false)
  const { data: explainData, isFetching: explainLoading } = useQuery({
    queryKey: qk.aiExplainOutlier(expense.id),
    queryFn: () => api.post('/ai/explain-outlier', { expense_id: expense.id }).then(r => r.data),
    enabled: explainRequested,
    staleTime: 30 * 60_000,
    retry: false,
  })

  const { data: recentData } = useQuery({
    queryKey: ['expenses', 'outlier-context', expense.id, expense.type],
    queryFn: () => api.get('/expenses', { params: { type: expense.type, sort_by: 'date', sort_dir: 'desc', page_size: 100 } })
      .then(r => {
        const all = r.data.expenses ?? []
        const idx = all.findIndex(e => e.id === expense.id)
        return idx === -1 ? all.slice(0, 5) : all.slice(Math.max(0, idx - 2), idx + 3)
      }),
    staleTime: 5 * 60_000,
  })
  const recent = recentData ?? null

  const typeEntry = typeMap[expense.type] || { color: C.dimText }
  const catColor = C.adaptColor(typeEntry.color)
  const severity = expense.z_score >= 3 ? C.overBudget : expense.z_score >= 2 ? C.atRisk : C.spent
  const severityLabel = expense.z_score >= 3 ? 'Very unusual' : expense.z_score >= 2 ? 'Notably high' : 'Somewhat high'
  const max = Math.max(expense.amount, expense.category_avg)
  const thisWidth = max > 0 ? Math.min(100, (expense.amount / max) * 100) : 0
  const avgWidth = max > 0 ? Math.min(100, (expense.category_avg / max) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold" style={{ color: C.warmText }}>{expense.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44` }}>{expense.type}</span>
            <span className="text-sm" style={{ color: C.muted }}>{formatShortDate(expense.date)}</span>
            <span className="text-sm font-bold" style={{ color: C.warmText }}>${expense.amount.toFixed(2)}</span>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: severity, color: '#fff' }}>+{expense.pct_above_avg}%</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full bg-transparent border-none cursor-pointer flex-shrink-0 transition-colors duration-150"
          style={{ color: C.muted }}
          onMouseEnter={e => { e.currentTarget.style.color = C.warmText }}
          onMouseLeave={e => { e.currentTarget.style.color = C.muted }}
        >
          <X size={16} />
        </button>
      </div>

      <div className="h-px mx-4" style={{ backgroundColor: `${catColor}30` }} />

      <div className="px-4 py-4 flex flex-col gap-5">
        {/* Z-score context */}
        <p className="text-sm" style={{ color: C.muted }}>
          <strong style={{ color: severity }}>{expense.z_score.toFixed(1)}σ</strong> above average — {severityLabel}
        </p>

        {/* Bar visualization */}
        <div className="flex flex-col gap-2.5">
          {[
            { label: 'This expense', width: thisWidth, color: severity, value: `$${expense.amount.toFixed(0)}` },
            { label: 'Category avg', width: avgWidth, color: catColor, value: `$${expense.category_avg.toFixed(0)}/avg`, muted: true },
          ].map(({ label, width, color, value, muted }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[11px] w-24 flex-shrink-0" style={{ color: C.muted }}>{label}</span>
              <div className="flex-1 h-2.5 rounded-full" style={{ backgroundColor: C.hoverStrong }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${width}%`, backgroundColor: color, opacity: muted ? 0.65 : 1 }} />
              </div>
              <span className="text-[11px] w-20 text-right flex-shrink-0 font-medium" style={{ color: muted ? C.muted : C.warmText }}>{value}</span>
            </div>
          ))}
        </div>

        {/* AI Explain */}
        {aiEnabled && (
          explainData ? (
            <div className="rounded-xl p-3 flex flex-col gap-2"
              style={{ backgroundColor: `${C.primary}0f`, border: `1px solid ${C.primary}30` }}>
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} style={{ color: C.primary }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: C.primary }}>AI Analysis</span>
              </div>
              <p className="text-sm" style={{ color: C.warmText }}>{explainData.explanation}</p>
              <p className="text-xs" style={{ color: C.muted }}><strong>Tip:</strong> {explainData.actionable}</p>
            </div>
          ) : explainLoading ? (
            <div className="flex items-center gap-2" style={{ color: C.muted }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">Analyzing…</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExplainRequested(true)}
              className="self-start flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-transparent cursor-pointer transition-colors duration-150"
              style={{ borderColor: C.primary, color: C.primary }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${C.primary}15` }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Sparkles size={12} />
              AI Explain
            </button>
          )
        )}

        {/* Recent in category */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: C.dimText }}>Recent in {expense.type}</p>
          {recent === null ? (
            <div className="flex flex-col gap-1.5">
              {[1, 2, 3].map(i => <div key={i} className="h-7 rounded-lg" style={{ backgroundColor: C.hoverStrong, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm" style={{ color: C.dimText }}>No other expenses found.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {recent.map(r => {
                const isThis = r.id === expense.id
                return (
                  <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{
                      backgroundColor: isThis ? `${catColor}15` : 'transparent',
                      border: isThis ? `1px solid ${catColor}30` : '1px solid transparent',
                    }}>
                    <span className="text-[11px] flex-shrink-0 w-14" style={{ color: C.dimText }}>{formatShortDate(r.date)}</span>
                    <span className="text-xs flex-1 truncate" style={{ color: isThis ? C.warmText : C.muted, fontWeight: isThis ? 600 : 400 }}>{r.name}</span>
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: isThis ? severity : C.muted }}>${r.amount.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap pt-1 border-t" style={{ borderColor: C.hoverStrong }}>
          <button
            onClick={() => { onEdit(expense); onClose() }}
            className="flex-1 h-9 rounded-xl text-sm font-medium bg-transparent border cursor-pointer transition-colors duration-150"
            style={{ borderColor: C.border, color: C.warmText, minWidth: 80 }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.hover }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            Edit
          </button>
          <button
            onClick={() => { onShowInExpenses(expense); onClose() }}
            className="flex-1 h-9 rounded-xl text-sm font-medium bg-transparent border cursor-pointer transition-colors duration-150"
            style={{ borderColor: C.border, color: C.warmText, minWidth: 80 }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = C.hover }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            Show in Expenses
          </button>
          <button
            onClick={() => { onDismiss(expense.id); onClose() }}
            className="flex-1 h-9 rounded-xl text-sm font-medium bg-transparent border cursor-pointer transition-colors duration-150"
            style={{ borderColor: C.border, color: C.warmText, minWidth: 80 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.overBudget; e.currentTarget.style.color = C.overBudget }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.warmText }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Outliers Section ─────────────────────────────────────────────────────────

function OutliersSection({ months, defaultMonth, onClearDefaultMonth, onShowInExpenses }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()
  const [showAllOutliers, setShowAllOutliers] = useState(false)

  const { data: settings } = useQuery({
    queryKey: qk.settings(),
    queryFn: () => api.get('/settings').then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const aiEnabled = settings?.ai_enabled ?? true
  const [editingExpense, setEditingExpense] = useState(null)
  const [filterMonth, setFilterMonth] = useState(defaultMonth ?? '')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const sectionRef = useRef(null)
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('budget_dismissed_outliers') ?? '[]')) }
    catch { return new Set() }
  })

  function handleDismiss(id) {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('budget_dismissed_outliers', JSON.stringify([...next]))
      return next
    })
  }

  function handleUndoDismiss() {
    setDismissedIds(new Set())
    localStorage.removeItem('budget_dismissed_outliers')
  }

  useEffect(() => {
    if (defaultMonth) {
      setFilterMonth(defaultMonth)
      setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    }
  }, [defaultMonth])

  const fetchMonths = defaultMonth ? Math.max(months, monthsFromNow(defaultMonth)) : months

  const { data, isFetching: loading } = useQuery({
    queryKey: qk.analysisOutliers(fetchMonths),
    queryFn: () => api.get('/analysis/outliers', { params: { months: fetchMonths } }).then(r => r.data),
    staleTime: 3 * 60_000,
  })

  const allData = data ?? []
  const availableMonths = [...new Set(allData.map(e => e.date.slice(0, 7)))].sort().reverse()
  const filtered = (filterMonth ? allData.filter(e => e.date.startsWith(filterMonth)) : allData)
    .filter(e => !dismissedIds.has(e.id))
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'amount') cmp = a.amount - b.amount
    else if (sortBy === 'pct') cmp = a.pct_above_avg - b.pct_above_avg
    else cmp = a.date.localeCompare(b.date)
    return sortDir === 'desc' ? -cmp : cmp
  })

  if (!loading && allData.length === 0) return null

  return (
    <>
      <Card
        ref={sectionRef}
        className="rounded-xl p-4 sm:p-6 mt-4"
      >
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <div className="flex items-start gap-2">
            <TriangleAlert size={20} className="flex-shrink-0 mt-0.5" style={{ color: C.atRisk }} />
            <h2 className="text-base sm:text-lg font-semibold" style={{ color: C.warmText }}>Unusual Expenses</h2>
          </div>
          {dismissedIds.size > 0 && (
            <button
              type="button"
              onClick={handleUndoDismiss}
              className="text-xs bg-transparent border-none cursor-pointer flex-shrink-0"
              style={{ color: C.muted }}
            >
              {dismissedIds.size} dismissed · undo
            </button>
          )}
        </div>
        <p className="text-sm mb-4" style={{ color: C.muted }}>
          Individual expenses significantly above their category average. Click to explore.
        </p>

        {allData.length > 0 && (
          <div className="flex gap-3 mb-4 flex-wrap">
            {availableMonths.length > 1 && (
              <select
                value={filterMonth}
                onChange={e => {
                  setFilterMonth(e.target.value)
                  if (!e.target.value) onClearDefaultMonth?.()
                }}
                className="h-9 rounded-lg border px-3 text-sm bg-transparent"
                style={{ borderColor: C.borderLight, color: C.warmText, minWidth: 160 }}
              >
                <option value="">All months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="h-9 rounded-lg border px-3 text-sm bg-transparent"
                style={{ borderColor: C.borderLight, color: C.warmText, minWidth: 140 }}
              >
                <option value="date">Date</option>
                <option value="amount">Amount</option>
                <option value="pct">Anomaly %</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const update = () => setSortDir(d => d === 'desc' ? 'asc' : 'desc')
                  if (document.startViewTransition) document.startViewTransition(() => startTransition(update))
                  else startTransition(update)
                }}
                className="h-9 w-9 flex items-center justify-center rounded-lg border bg-transparent cursor-pointer"
                style={{ borderColor: C.borderLight, color: C.muted }}
              >
                <span style={{ viewTransitionName: 'outlier-sort-arrow', display: 'inline-flex' }}>
                  {sortDir === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
                </span>
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm" style={{ color: C.muted }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm" style={{ color: C.muted }}>
            {allData.length === 0
              ? 'No unusual expenses detected in the selected period. Need at least 3 expenses per category to compute.'
              : `No unusual expenses in ${formatMonthLabel(filterMonth)}.`}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {(showAllOutliers ? sorted : sorted.slice(0, 3)).map(e => {
              const typeEntry = typeMap[e.type] || { color: C.dimText }
              const catColor = C.adaptColor(typeEntry.color)
              const severity = e.z_score >= 3 ? C.overBudget : e.z_score >= 2 ? C.atRisk : C.spent
              const cardTrigger = (
                <div
                  className="px-4 py-3 rounded-xl transition-colors duration-150"
                  style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface }}
                  onMouseEnter={ev => { ev.currentTarget.style.backgroundColor = `${catColor}18`; ev.currentTarget.style.borderColor = C.borderMed }}
                  onMouseLeave={ev => { ev.currentTarget.style.backgroundColor = C.surface; ev.currentTarget.style.borderColor = C.border }}
                >
                  {/* Desktop */}
                  <div className="hidden sm:flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words" style={{ color: C.warmText }}>{e.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${catColor}22`, color: catColor, border: `1px solid ${catColor}44` }}>{e.type}</span>
                        <span className="text-sm" style={{ color: C.muted }}>{formatShortDate(e.date)} · avg ${e.category_avg.toFixed(2)} in this category</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold" style={{ color: C.warmText }}>${e.amount.toFixed(2)}</span>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: severity, color: '#fff' }}>+{e.pct_above_avg}%</span>
                    </div>
                  </div>
                  {/* Mobile */}
                  <div className="sm:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate flex-shrink" style={{ color: C.warmText }}>{e.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold" style={{ color: C.warmText }}>${e.amount.toFixed(2)}</span>
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: severity, color: '#fff' }}>+{e.pct_above_avg}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${typeEntry.color}22`, color: typeEntry.color, border: `1px solid ${typeEntry.color}44` }}>{e.type}</span>
                      <span className="text-xs" style={{ color: C.muted }}>{formatShortDate(e.date)} · avg ${e.category_avg.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )
              return (
                <ExpandableCard key={e.id} id={e.id} trigger={cardTrigger} accentColor={catColor}>
                  {(close) => (
                    <OutlierExpandedContent
                      expense={e}
                      onEdit={setEditingExpense}
                      onDismiss={handleDismiss}
                      onShowInExpenses={onShowInExpenses}
                      onClose={close}
                      aiEnabled={aiEnabled}
                    />
                  )}
                </ExpandableCard>
              )
            })}
            {sorted.length > 3 && (
              <ShowMoreToggle shown={showAllOutliers} total={sorted.length} label="expenses" onToggle={() => setShowAllOutliers(v => !v)} />
            )}
          </div>
        )}
      </Card>
      {editingExpense && (
        <AddExpenseForm
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onAdded={() => setEditingExpense(null)}
        />
      )}
    </>
  )
}

// ─── Month-over-Month Section ─────────────────────────────────────────────────

function MonthOverMonthSection({ months }) {
  const C = useC()

  const { data = [] } = useQuery({
    queryKey: qk.analysisMonthOverMonth(months),
    queryFn: () => api.get('/analysis/month-over-month', { params: { months } }).then(r => r.data),
    staleTime: 3 * 60_000,
  })

  const chartData = data.map(d => ({ ...d, label: shortMonth(d.month) }))
  const avgSpent = data.length > 0 ? data.reduce((s, d) => s + d.total_spent, 0) / data.length : 0

  return (
    <Card className="rounded-xl p-4 sm:p-6 mt-4 mb-4">
      <h2 className="text-base sm:text-lg font-semibold mb-0.5" style={{ color: C.warmText }}>Monthly Trends</h2>
      <p className="text-sm mb-4" style={{ color: C.muted }}>Total spending, income, and net by month</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {data.map(d => {
          if (d.mom_change_pct === null) return null
          const up = d.mom_change_pct > 0
          return (
            <span
              key={d.month}
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{ color: up ? C.overBudget : C.onTrack, borderColor: up ? C.overBudget : C.onTrack }}
            >
              {shortMonth(d.month)} {up ? '+' : ''}{d.mom_change_pct.toFixed(1)}%
            </span>
          )
        })}
      </div>

      {data.length === 0 ? (
        <p className="text-sm" style={{ color: C.muted }}>No data.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} />
            <XAxis dataKey="label" tick={{ fill: C.tickLight, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.dimText, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: C.warmText }}
              formatter={(val, name) => [`$${Number(val).toFixed(2)}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: C.dimText }} />
            <Bar dataKey="total_spent" name="Spent" fill={C.netPositive} radius={[3, 3, 0, 0]}>
              {chartData.map(entry => (
                <Cell key={entry.month} fill={entry.net > 0 ? C.netPositive : C.netNegative} />
              ))}
            </Bar>
            <Line type="monotone" dataKey="total_income" name="Income" stroke={C.income} strokeWidth={2} dot={{ r: 3, fill: C.income }} />
            <Line type="monotone" dataKey="net" name="Net" stroke={C.netLine} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2, fill: C.netLine }} />
            {avgSpent > 0 && (
              <ReferenceLine y={avgSpent} stroke={C.borderStrong} strokeDasharray="4 4"
                label={{ value: 'avg', fill: C.dimText, fontSize: 11, position: 'insideTopRight' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage({ outlierMonth, onClearOutlierMonth, onShowInExpenses }) {
  const C = useC()
  const [pacingMonth, setPacingMonth] = useState(currentMonth())
  const [historyMonths, setHistoryMonths] = useState(() => {
    const saved = parseInt(localStorage.getItem('budget_history_months'), 10)
    return isNaN(saved) ? 6 : saved
  })

  useEffect(() => {
    localStorage.setItem('budget_history_months', String(historyMonths))
  }, [historyMonths])
  const { data: monthsAvail } = useQuery({
    queryKey: qk.analysisMonthsAvailable(),
    queryFn: () => api.get('/analysis/months-available').then(r => r.data),
    staleTime: 10 * 60_000,
  })
  const maxMonths = Math.max(monthsAvail?.months ?? 12, 2)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: C.warmText }}>Spending Analysis</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>Pacing, budget performance, outliers, and trends</p>
        </div>
        <div style={{ minWidth: 240 }}>
          <MonthSlider value={historyMonths} onChange={setHistoryMonths} min={1} max={maxMonths} />
        </div>
      </div>

      <PacingSection month={pacingMonth} onMonthChange={setPacingMonth} maxMonths={maxMonths} />
      <BudgetPerformanceSection months={historyMonths} />
      <OutliersSection months={historyMonths} defaultMonth={outlierMonth} onClearDefaultMonth={onClearOutlierMonth} onShowInExpenses={onShowInExpenses} />
      <MonthOverMonthSection months={historyMonths} />
    </div>
  )
}
