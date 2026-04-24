import { useEffect, useState, useCallback } from 'react'
import { startTransition } from 'react'
import { Plus, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '../api.js'
import { ICON_REGISTRY } from '../expenseTypes.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { useC } from '../colors'
import SpendingChart from './SpendingChart.jsx'
import AddIncomeForm from './AddIncomeForm.jsx'

const CARD_LIMIT = 9

function StatusBadge({ label, color }) {
  return (
    <span
      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: color, color: '#fff' }}
    >
      {label}
    </span>
  )
}

function TwoToneBar({ pct, solidColor, ghostStart, ghostWidth, trackColor }) {
  return (
    <div className="relative h-1 rounded-full overflow-hidden mb-1.5" style={{ backgroundColor: trackColor }}>
      {ghostWidth !== null && ghostWidth > 0 && (
        <div
          className="absolute top-0 h-full rounded-full"
          style={{ left: `${ghostStart}%`, width: `${ghostWidth}%`, backgroundColor: solidColor, opacity: 0.4 }}
        />
      )}
      <div
        className="absolute top-0 left-0 h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: solidColor }}
      />
    </div>
  )
}

export default function SummaryBar({ refreshKey, selectedMonth, activeType, onTypeChange, activeMacro, onMacroChange, hideHeader = false, defaultCollapsed = false }) {
  const C = useC()
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
  const [categoriesOpen, setCategoriesOpen] = useState(!defaultCollapsed)

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

  useEffect(() => { fetchData() }, [fetchData, refreshKey])

  const totalSpent = summary.reduce((sum, s) => sum + s.total, 0)
  const totalBudget = Object.values(budgets).reduce((sum, v) => sum + v, 0)
  const grandOver = totalBudget > 0 && totalSpent > totalBudget
  const net = totalIncome - totalSpent
  const hasIncome = totalIncome > 0

  const totalProjected = isCurrentMonth
    ? Object.values(pacing).reduce((sum, p) => sum + (p.projected_spend ?? p.spent ?? 0), 0)
    : null
  const projectedOver = totalBudget > 0 && totalProjected != null && totalProjected > totalBudget

  return (
    <div
      className="rounded-2xl p-4 sm:p-6 mb-6 cursor-pointer"
      onClick={() => setCategoriesOpen(o => !o)}
      style={{
        backgroundColor: C.surface,
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        border: `1px solid ${C.border}`,
        contain: 'layout style',
      }}
    >
      {!hideHeader && (
        <>
          {/* Spending header */}
          <div
            className="rounded-2xl p-5 mb-6"
            style={{ background: C.surfaceAlt }}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-3xl font-bold leading-none">${totalSpent.toFixed(2)}</p>
                {totalBudget > 0 && (
                  <p className="text-sm mt-1" style={{ color: C.muted }}>of ${totalBudget.toFixed(2)} budget</p>
                )}
                {totalProjected != null && totalBudget > 0 && (
                  <p className="text-sm mt-0.5" style={{ color: projectedOver ? C.overBudget : C.muted }}>
                    ${totalProjected.toFixed(2)} projected
                  </p>
                )}
              </div>
              {totalBudget > 0 && (
                <div className="text-right pt-1">
                  <p
                    className="text-lg font-bold leading-tight"
                    style={{ color: grandOver ? C.overBudget : C.primary }}
                  >
                    {grandOver
                      ? `$${(totalSpent - totalBudget).toFixed(2)} over budget`
                      : `$${(totalBudget - totalSpent).toFixed(2)} remaining`}
                  </p>
                  {totalProjected != null && (
                    <p className="text-sm mt-0.5" style={{ color: projectedOver ? C.overBudget : C.muted }}>
                      {projectedOver
                        ? `$${(totalProjected - totalBudget).toFixed(2)} proj. over`
                        : `$${(totalBudget - totalProjected).toFixed(2)} proj. remaining`}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Income / Net row */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex gap-6 flex-wrap">
              <div>
                <span className="text-xs" style={{ color: C.muted }}>Income</span>
                <p className="text-base font-semibold" style={{ color: hasIncome ? C.income : C.muted }}>
                  ${totalIncome.toFixed(2)}
                </p>
              </div>
              {hasIncome && (
                <div>
                  <span className="text-xs" style={{ color: C.muted }}>Net</span>
                  <div className="flex items-center gap-1">
                    {net >= 0
                      ? <TrendingUp size={16} style={{ color: C.primary }} />
                      : <TrendingDown size={16} style={{ color: C.overBudget }} />}
                    <p className="text-base font-semibold" style={{ color: net >= 0 ? C.primary : C.overBudget }}>
                      {net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setEditingIncome(null); setShowIncomeForm(true) }}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border transition-colors duration-150 cursor-pointer bg-transparent"
              style={{ borderColor: C.incomeButtonBg, color: C.incomeButtonBg }}
            >
              <Plus size={16} />
              Add Income
            </button>
          </div>

          <div className="h-px mb-6" style={{ backgroundColor: C.hoverStrong }} />

          {/* Macrocategory summary cards */}
          {macroSummary.length > 0 && (
            <>
              <div className="flex flex-wrap gap-4 mb-4">
                {macroSummary.map(m => {
                  const isSelected = activeMacro === m.id
                  const hasBudget = m.budget_limit > 0
                  const over = hasBudget && m.total > m.budget_limit
                  const pct = hasBudget ? Math.min((m.total / m.budget_limit) * 100, 100) : null
                  const mColor = C.adaptColor(m.color ?? C.dimText)
                  return (
                    <div
                      key={m.id}
                      onClick={() => onMacroChange?.(isSelected ? null : m.id)}
                      className="flex-1 min-w-0 sm:min-w-[160px] rounded-xl p-3 cursor-pointer transition-colors duration-150"
                      style={{
                        backgroundColor: isSelected ? `${mColor}${C.cardTintSelectedAlpha}` : `${mColor}${C.cardTintAlpha}`,
                        border: isSelected ? `1.5px solid ${mColor}` : `1px solid ${mColor}${C.cardBorderAlpha}`,
                      }}
                    >
                      <p className="text-sm mb-1" style={{ color: C.muted }}>{m.name}</p>
                      <p className="text-lg font-bold leading-tight mb-1" style={{ color: over ? C.overBudget : mColor }}>
                        ${m.total.toFixed(2)}
                        {hasBudget && <span className="text-xs font-normal ml-1" style={{ color: C.muted }}>/ ${m.budget_limit.toFixed(0)}</span>}
                      </p>
                      {pct !== null && (
                        <div className="h-1 rounded-full mb-1.5" style={{ backgroundColor: C.hoverStrong }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: over ? C.overBudget : mColor }} />
                        </div>
                      )}
                      <span className="text-xs" style={{ color: C.muted }}>
                        {m.count} {m.count === 1 ? 'expense' : 'expenses'}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="h-px mb-6" style={{ backgroundColor: C.hoverStrong }} />
            </>
          )}
        </>
      )}

      {/* Category cards toggle header */}
      <div
        className="flex items-center justify-between select-none -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 rounded-2xl"
        style={{ marginBottom: categoriesOpen ? 8 : 0 }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>
          All Categories
        </p>
        <button type="button" className="p-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: C.muted }}>
          {categoriesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Collapse — grid-rows trick: animates 1fr↔0fr with no layout cost */}
      <div
        className="transition-[grid-template-rows] duration-300"
        style={{ display: 'grid', gridTemplateRows: categoriesOpen ? '1fr' : '0fr' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...summary]
            .filter(s => !activeMacro || typeMap[s.type]?.macrocategory_id === activeMacro)
            .sort((a, b) => {
              const pctA = budgets[a.type] > 0 ? a.total / budgets[a.type] : -1
              const pctB = budgets[b.type] > 0 ? b.total / budgets[b.type] : -1
              return pctB - pctA
            })
            .slice(0, (showAllCards || activeMacro) ? undefined : CARD_LIMIT)
            .map(s => {
              const typeEntry = typeMap[s.type] || { color: C.dimText, icon: null }
              const IconComp = typeEntry.icon ? ICON_REGISTRY[typeEntry.icon] : null
              const limit = budgets[s.type]
              const pct = limit > 0 ? Math.min((s.total / limit) * 100, 100) : null
              const over = limit > 0 && s.total > limit
              const isSelected = activeType === s.type
              const catColor = C.adaptColor(typeEntry.color ?? C.dimText)

              const pac = pacing[s.type]
              const actuallyOver = limit > 0 && s.total > limit
              const solidColor = actuallyOver ? C.overBudget : catColor
              const statusColor = pac?.status === 'over_budget' ? C.overBudget
                : pac?.status === 'at_risk' ? C.atRisk
                : pac?.status === 'well_under' ? C.nearGoal
                : C.primary
              const projPct = isCurrentMonth && pac?.projected_spend != null && pac.projected_spend > s.total && limit > 0
                ? Math.min((pac.projected_spend / limit) * 100, 100)
                : null
              const ghostWidth = projPct !== null ? projPct - (pct ?? 0) : null

              return (
                <div
                  key={s.type}
                  onClick={() => onTypeChange?.(isSelected ? 'All' : s.type)}
                  className="rounded-xl p-3 transition-colors duration-150 min-w-0"
                  style={{
                    backgroundColor: isSelected ? `${catColor}${C.cardTintSelectedAlpha}` : `${catColor}${C.cardTintAlpha}`,
                    border: isSelected ? `1.5px solid ${catColor}` : `1px solid ${catColor}${C.cardBorderAlpha}`,
                    cursor: onTypeChange ? 'pointer' : 'default',
                    viewTransitionName: `vt-card-${s.type.replace(/[^a-zA-Z0-9]/g, '-')}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {IconComp && <IconComp style={{ fontSize: '18px', color: catColor }} />}
                    <span className="text-sm" style={{ color: C.muted }}>{s.type}</span>
                  </div>
                  <p className="text-lg font-bold leading-tight mb-1" style={{ color: over ? C.overBudget : catColor }}>
                    ${s.total.toFixed(2)}
                    {limit > 0 && (
                      <span className="text-xs font-normal ml-1" style={{ color: C.muted }}>/ ${limit.toFixed(0)}</span>
                    )}
                  </p>
                  {pct !== null && (
                    <TwoToneBar
                      pct={pct}
                      solidColor={solidColor}
                      ghostStart={pct}
                      ghostWidth={ghostWidth}
                      trackColor={C.hoverStrong}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: C.muted }}>
                      {s.count} {s.count === 1 ? 'expense' : 'expenses'}
                    </span>
                    {isCurrentMonth && pac?.status && pac.status !== 'no_budget' ? (
                      <StatusBadge
                        label={pac.status === 'over_budget' ? `$${(pac.projected_spend - limit).toFixed(0)} proj. over`
                          : pac.status === 'at_risk' ? 'at risk'
                          : pac.status === 'well_under' ? 'under budget'
                          : 'on track'}
                        color={statusColor}
                      />
                    ) : over ? (
                      <span className="text-xs font-semibold" style={{ color: C.overBudget }}>
                        ${(s.total - limit).toFixed(2)} over
                      </span>
                    ) : null}
                  </div>
                  {isCurrentMonth && pac?.projected_spend != null && (
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                      → ${pac.projected_spend.toFixed(2)} projected
                    </p>
                  )}
                </div>
              )
            })}
          {summary.length === 0 && (
            <p className="text-sm py-2" style={{ color: C.muted }}>No expenses this month yet. Add one below!</p>
          )}
          {summary.length > CARD_LIMIT && (
            <div className="col-span-2 sm:col-span-3 xl:col-span-4">
              <button
                type="button"
                onClick={() => {
                  const update = () => setShowAllCards(v => !v)
                  if (document.startViewTransition) document.startViewTransition(() => startTransition(update))
                  else startTransition(update)
                }}
                className="min-h-[40px] flex items-center text-sm bg-transparent border-none cursor-pointer font-[inherit]"
                style={{ color: C.muted }}
              >
                {showAllCards ? 'Show less ↑' : `Show all ${summary.length} categories ↓`}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

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
    </div>
  )
}
