import { useState, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import api from '../api.js'
import { qk } from '../queryKeys.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { useC } from '../colors'
import { Card } from 'glasscn-ui'
import MonthSlider from './MonthSlider.jsx'

function shortLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'short' })
}

function fullLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function CustomTooltip({ active, payload, totalBudget, activeType, expenseTypes, categoryBudgets }) {
  const C = useC()
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  if (!entry) return null

  const income = entry.income ?? 0
  const expenseRows = expenseTypes
    .map(t => ({ name: t.name, color: t.color, value: entry[t.name] ?? 0, budget: categoryBudgets?.[t.name] }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)

  const totalSpent = expenseRows.reduce((s, r) => s + r.value, 0)

  function fmtRow(value, budget) {
    const spent = `$${value.toFixed(0)}`
    return budget > 0 ? `${spent} / $${budget.toFixed(0)}` : spent
  }

  return (
    <div
      className="rounded-lg px-3 py-2 min-w-[180px]"
      style={{ backgroundColor: C.surfacePopup, border: `1px solid ${C.border}` }}
    >
      <p className="text-sm font-semibold mb-1">{entry.fullLabel}</p>
      {activeType !== 'All'
        ? (
          <span className="block text-xs" style={{ color: expenseTypes.find(t => t.name === activeType)?.color ?? C.muted }}>
            {activeType}: {fmtRow(entry[activeType] ?? 0, categoryBudgets?.[activeType])}
          </span>
        )
        : expenseRows.map(r => (
          <span key={r.name} className="block text-xs" style={{ color: r.color }}>
            {r.name}: {fmtRow(r.value, r.budget)}
          </span>
        ))
      }
      <span className="block text-xs mt-0.5" style={{ color: C.muted }}>
        Total: {fmtRow(activeType !== 'All' ? (entry[activeType] ?? 0) : totalSpent, totalBudget)}
      </span>
      {income > 0 && (
        <span className="block text-xs mt-0.5" style={{ color: C.income }}>
          Income: ${income.toFixed(0)}
        </span>
      )}
    </div>
  )
}

export default function MonthlyTrendsChart({ selectedMonth, activeType = 'All', onTypeChange, activeMacro, onMacroChange }) {
  const C = useC()
  const INCOME_COLOR = C.income
  const TICK = { fill: C.muted, fontSize: 12 }
  const AXIS_LINE = { stroke: C.border }
  const { expenseTypes, macroMap } = useExpenseTypes()
  const [monthsToShow, setMonthsToShow] = useState(6)
  const [hoveredBar, setHoveredBar] = useState(false)

  const { data: monthsAvail } = useQuery({
    queryKey: qk.analysisMonthsAvailable(),
    queryFn: () => api.get('/analysis/months-available').then(r => r.data),
    staleTime: 10 * 60_000,
  })
  const maxMonths = Math.max(monthsAvail?.months ?? 12, 2)

  const { data: byTypeData = [], isFetching: fetchingByType, isPlaceholderData: byTypePlaceholder } = useQuery({
    queryKey: qk.expensesMonthlyByType(monthsToShow),
    queryFn: () => api.get('/expenses/monthly-by-type', { params: { months: monthsToShow } }).then(r => r.data),
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  })

  const { data: incomeTotals = [], isFetching: fetchingIncome, isPlaceholderData: incomePlaceholder } = useQuery({
    queryKey: qk.incomesMonthlyTotals(monthsToShow),
    queryFn: () => api.get('/incomes/monthly-totals', { params: { months: monthsToShow } }).then(r => r.data),
    staleTime: 2 * 60_000,
    placeholderData: keepPreviousData,
  })

  const { data: budgetsRange = [], isFetching: fetchingBudgets } = useQuery({
    queryKey: qk.budgetsEffectiveRange(monthsToShow),
    queryFn: () => api.get('/budgets/effective-range', { params: { months: monthsToShow } }).then(r => r.data),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })

  const isLoading = fetchingByType || fetchingIncome || fetchingBudgets

  const budgetByMonth = Object.fromEntries(budgetsRange.map(r => [r.month, r]))
  const defaultByType = budgetsRange[0]?.by_type ?? {}
  const defaultTotal = Object.values(defaultByType).reduce((s, v) => s + v, 0)
  const totalBudget = defaultTotal
  const budgetByType = defaultByType
  const hasOverrides = budgetsRange.some(r => Math.abs(r.total - defaultTotal) > 0.001
    || Object.entries(r.by_type).some(([t, v]) => Math.abs(v - (defaultByType[t] ?? 0)) > 0.001))

  // Budget months must NOT extend the axis — they can cover different ranges than transaction
  // data and inject phantom empty bars. Budget data is looked up per-month in chartData below.
  const monthSet = new Set([
    ...byTypeData.map(r => r.month),
    ...incomeTotals.map(r => r.month),
  ])
  const current = currentMonth()
  const incomeByMonth = Object.fromEntries(incomeTotals.map(r => [r.month, r.total]))
  const chartData = [...monthSet].sort().map(m => {
    const bm = budgetByMonth[m]
    const row = {
      month: m, label: shortLabel(m), fullLabel: fullLabel(m),
      income: incomeByMonth[m] ?? 0,
      budget: bm?.total ?? defaultTotal,
      budgetByType: bm?.by_type ?? defaultByType,
      isCurrent: m === current,
      isFuture: m > current,
    }
    byTypeData.filter(r => r.month === m).forEach(r => { row[r.type] = r.total })
    return row
  })

  if (!isLoading && chartData.length === 0) return null
  const hasAnyData = chartData.some(d =>
    expenseTypes.some(t => (d[t.name] ?? 0) > 0) || d.income > 0
  )
  if (!isLoading && !hasAnyData) return null

  const activeTypes = expenseTypes.filter(t =>
    chartData.some(d => (d[t.name] ?? 0) > 0) &&
    (!activeMacro || t.macrocategory_id === activeMacro)
  )

  const yMax = Math.ceil((Math.max(
    ...chartData.map(d => {
      const spent = activeTypes.reduce((s, t) => s + (d[t.name] ?? 0), 0)
      return Math.max(spent, d.income, d.budget ?? 0)
    }),
    1
  ) * 1.2) / 100) * 100

  function handleBarClick(typeName) {
    if (onTypeChange) {
      onTypeChange(activeType === typeName ? 'All' : typeName)
    }
  }

  return (
    <Card
      className="rounded-2xl p-4 sm:p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium" style={{ color: C.muted }}>
          Monthly Spending
          {activeMacro && macroMap[activeMacro] && (
            <span className="ml-2" style={{ color: macroMap[activeMacro].color }}>
              · {macroMap[activeMacro].name}
            </span>
          )}
          {!activeMacro && activeType !== 'All' && activeType !== 'Income' && (
            <span className="ml-2" style={{ color: expenseTypes.find(t => t.name === activeType)?.color }}>
              · {activeType}
            </span>
          )}
        </p>
        <div className="flex items-center gap-3">
          <div style={{ minWidth: 200 }}>
            <MonthSlider value={monthsToShow} onChange={setMonthsToShow} min={2} max={maxMonths} />
          </div>
          {activeMacro ? (
            <button
              type="button"
              onClick={() => onMacroChange?.(null)}
              className="min-h-[40px] flex items-center cursor-pointer bg-transparent border-none font-[inherit] text-sm transition-colors duration-150"
              style={{ color: C.muted }}
            >
              Clear group filter ×
            </button>
          ) : activeType !== 'All' && activeType !== 'Income' ? (
            <button
              type="button"
              onClick={() => onTypeChange?.('All')}
              className="min-h-[40px] flex items-center cursor-pointer bg-transparent border-none font-[inherit] text-sm transition-colors duration-150"
              style={{ color: C.muted }}
            >
              Clear filter ×
            </button>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      {(totalBudget > 0 || chartData.some(d => d.income > 0)) && (
        <div className="flex gap-6 mb-4 items-center">
          {chartData.some(d => d.income > 0) && (
            <div className="flex items-center gap-1.5">
              <svg width="22" height="12">
                <line x1="0" y1="6" x2="22" y2="6" stroke={INCOME_COLOR} strokeWidth="2" />
                <circle cx="11" cy="6" r="3" fill={INCOME_COLOR} />
              </svg>
              <span className="text-xs" style={{ color: C.muted }}>Income</span>
            </div>
          )}
          {totalBudget > 0 && (
            <div className="flex items-center gap-1.5">
              <svg width="22" height="12">
                <line x1="0" y1="6" x2="22" y2="6" stroke={C.muted} strokeWidth="1.5" strokeDasharray="4 3" />
              </svg>
              <span className="text-xs" style={{ color: C.muted }}>Budget</span>
            </div>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={chartData}
          barCategoryGap="30%"
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="label"
            axisLine={AXIS_LINE}
            tickLine={false}
            tick={props => {
              const entry = chartData[props.index]
              const isFuture = entry?.isFuture
              return (
                <text
                  x={props.x}
                  y={props.y + 10}
                  textAnchor="middle"
                  fill={isFuture ? C.borderStrong : TICK.fill}
                  fontSize={TICK.fontSize}
                >
                  {props.payload.value}
                  {isFuture ? ' ~' : ''}
                </text>
              )
            }}
          />
          <YAxis
            tickFormatter={v => `$${v}`}
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={[0, yMax]}
          />
          {(() => {
            const isTypeFilter = activeType !== 'All' && activeType !== 'Income'
            const refColor = isTypeFilter
              ? (expenseTypes.find(t => t.name === activeType)?.color ?? C.borderStrong)
              : C.borderStrong
            const refBudget = isTypeFilter ? (budgetByType[activeType] ?? 0) : totalBudget
            if (refBudget <= 0) return null
            if (hasOverrides) return null
            return (
              <ReferenceLine
                y={refBudget}
                stroke={refColor}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: `${isTypeFilter ? activeType : 'Total'} budget $${refBudget.toFixed(0)}`,
                  position: 'insideTopRight',
                  fill: refColor,
                  fontSize: 11,
                  opacity: 0.8,
                }}
              />
            )
          })()}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!hoveredBar) return null
              const entry = payload?.[0]?.payload
              const perMonthBudget = entry
                ? (activeType !== 'All' && activeType !== 'Income'
                    ? (entry.budgetByType?.[activeType] ?? budgetByType[activeType] ?? 0)
                    : (entry.budget ?? totalBudget))
                : 0
              return (
                <CustomTooltip
                  active={active}
                  payload={payload}
                  label={label}
                  totalBudget={perMonthBudget}
                  activeType={activeType}
                  expenseTypes={expenseTypes}
                  categoryBudgets={entry?.budgetByType ?? budgetByType}
                />
              )
            }}
            cursor={{ fill: C.hover }}
            wrapperStyle={{ zIndex: 1400 }}
          />

          {(() => {
            const isFiltered = activeType !== 'All' && activeType !== 'Income'
            const visibleTypes = isFiltered ? activeTypes.filter(t => t.name === activeType) : activeTypes
            return visibleTypes.map((t, i) => (
              <Bar
                key={t.name}
                dataKey={t.name}
                stackId="expenses"
                fill={t.color}
                radius={i === visibleTypes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={48}
                style={{ cursor: onTypeChange ? 'pointer' : 'default' }}
                onClick={() => handleBarClick(t.name)}
                onMouseEnter={() => setHoveredBar(true)}
                onMouseLeave={() => setHoveredBar(false)}
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fillOpacity={entry.isFuture ? 0.35 : 1} />
                ))}
              </Bar>
            ))
          })()}

          <Line
            type="monotone"
            dataKey="income"
            stroke={INCOME_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: INCOME_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />

          {hasOverrides && (() => {
            const isTypeFilter = activeType !== 'All' && activeType !== 'Income'
            const refColor = isTypeFilter
              ? (expenseTypes.find(t => t.name === activeType)?.color ?? C.muted)
              : C.muted
            const refBudget = isTypeFilter ? (budgetByType[activeType] ?? 0) : totalBudget
            if (refBudget <= 0) return null
            return (
              <Line
                type="monotone"
                dataKey={isTypeFilter ? `budgetByType.${activeType}` : 'budget'}
                stroke={refColor}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
                connectNulls
              />
            )
          })()}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  )
}
