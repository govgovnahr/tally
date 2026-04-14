import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Cell,
} from 'recharts'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'

const MONTH_OPTIONS = [6, 12, 24]
const INCOME_COLOR = '#80cbc4'
const TICK = { fill: 'rgba(240, 234, 214, 0.55)', fontSize: 12 }
const AXIS_LINE = { stroke: 'rgba(240, 234, 214, 0.12)' }

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

function CustomTooltip({ active, payload, label, totalBudget, activeType, expenseTypes }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  if (!entry) return null

  const income = entry.income ?? 0
  const expenseRows = expenseTypes
    .map(t => ({ name: t.name, color: t.color, value: entry[t.name] ?? 0 }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)

  const totalSpent = expenseRows.reduce((s, r) => s + r.value, 0)

  return (
    <Box sx={{
      bgcolor: '#22252e',
      border: '1px solid rgba(240,234,214,0.12)',
      borderRadius: 1,
      px: 1.5,
      py: 1,
      minWidth: 160,
    }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
        {entry.fullLabel}
      </Typography>
      {activeType !== 'All'
        ? (
          <Typography variant="caption" sx={{ display: 'block', color: expenseTypes.find(t => t.name === activeType)?.color ?? 'text.secondary' }}>
            {activeType}: ${(entry[activeType] ?? 0).toFixed(2)}
          </Typography>
        )
        : expenseRows.map(r => (
          <Typography key={r.name} variant="caption" sx={{ display: 'block', color: r.color }}>
            {r.name}: ${r.value.toFixed(2)}
          </Typography>
        ))
      }
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25 }}>
        Total: ${activeType !== 'All' ? (entry[activeType] ?? 0).toFixed(2) : totalSpent.toFixed(2)}
      </Typography>
      {income > 0 && (
        <Typography variant="caption" sx={{ display: 'block', color: INCOME_COLOR, mt: 0.25 }}>
          Income: ${income.toFixed(2)}
        </Typography>
      )}
      {totalBudget > 0 && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          Budget: ${totalBudget.toFixed(2)}
        </Typography>
      )}
    </Box>
  )
}

export default function MonthlyTrendsChart({ refreshKey, selectedMonth, activeType = 'All', onTypeChange, activeMacro, onMacroChange }) {
  const { expenseTypes, macroMap } = useExpenseTypes()
  const [monthsToShow, setMonthsToShow] = useState(6)
  const [chartData, setChartData] = useState([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [budgetByType, setBudgetByType] = useState({})
  const [hasOverrides, setHasOverrides] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/expenses/monthly-by-type', { params: { months: monthsToShow } }),
      api.get('/incomes/monthly-totals', { params: { months: monthsToShow } }),
      api.get('/budgets/effective-range', { params: { months: monthsToShow } }),
    ]).then(([byTypeRes, incomeRes, budgetsRes]) => {
      // budgetsRes.data: [{ month, total, by_type }]
      const budgetByMonth = Object.fromEntries(budgetsRes.data.map(r => [r.month, r]))
      // Default (first entry's by_type as baseline for budgetByType)
      const defaultByType = budgetsRes.data[0]?.by_type ?? {}
      const defaultTotal = Object.values(defaultByType).reduce((s, v) => s + v, 0)
      setTotalBudget(defaultTotal)
      setBudgetByType(defaultByType)

      // Check if any month in the range has a different total (i.e. has overrides)
      const anyOverrides = budgetsRes.data.some(r => Math.abs(r.total - defaultTotal) > 0.001
        || Object.entries(r.by_type).some(([t, v]) => Math.abs(v - (defaultByType[t] ?? 0)) > 0.001))
      setHasOverrides(anyOverrides)

      // Build a set of all months that appear in either dataset
      const monthSet = new Set([
        ...byTypeRes.data.map(r => r.month),
        ...incomeRes.data.map(r => r.month),
        ...budgetsRes.data.map(r => r.month),
      ])
      const current = currentMonth()
      const months = [...monthSet].sort()

      // Build per-month objects with type breakdown + income + budget
      const incomeByMonth = Object.fromEntries(incomeRes.data.map(r => [r.month, r.total]))

      const built = months.map(m => {
        const bm = budgetByMonth[m]
        const row = {
          month: m,
          label: shortLabel(m),
          fullLabel: fullLabel(m),
          income: incomeByMonth[m] ?? 0,
          budget: bm?.total ?? defaultTotal,
          budgetByType: bm?.by_type ?? defaultByType,
          isCurrent: m === current,
          isFuture: m > current,
          isSelected: m === selectedMonth,
        }
        byTypeRes.data.filter(r => r.month === m).forEach(r => {
          row[r.type] = r.total
        })
        return row
      })

      setChartData(built)
    })
  }, [refreshKey, selectedMonth, monthsToShow])

  if (chartData.length === 0) return null
  const hasAnyData = chartData.some(d =>
    expenseTypes.some(t => (d[t.name] ?? 0) > 0) || d.income > 0
  )
  if (!hasAnyData) return null

  // Determine which types actually have data in this window, filtered by macrocategory if active
  const activeTypes = expenseTypes.filter(t =>
    chartData.some(d => (d[t.name] ?? 0) > 0) &&
    (!activeMacro || t.macrocategory_id === activeMacro)
  )

  // Y-axis domain
  const yMax = Math.ceil((Math.max(
    ...chartData.map(d => {
      const spent = activeTypes.reduce((s, t) => s + (d[t.name] ?? 0), 0)
      return Math.max(spent, d.income, d.budget ?? 0)
    }),
    1
  ) * 1.2)/100) * 100 // round to nice number

  function handleBarClick(typeName) {
    if (onTypeChange) {
      onTypeChange(activeType === typeName ? 'All' : typeName)
    }
  }

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          Monthly Spending
          {activeMacro && macroMap[activeMacro] && (
            <Typography component="span" variant="body2" sx={{ ml: 1, color: macroMap[activeMacro].color }}>
              · {macroMap[activeMacro].name}
            </Typography>
          )}
          {!activeMacro && activeType !== 'All' && activeType !== 'Income' && (
            <Typography component="span" variant="body2"
              sx={{ ml: 1, color: expenseTypes.find(t => t.name === activeType)?.color }}>
              · {activeType}
            </Typography>
          )}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            {MONTH_OPTIONS.map(n => (
              <Box
                key={n}
                onClick={() => setMonthsToShow(n)}
                sx={{ minHeight: 40, minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: monthsToShow === n ? 600 : 400,
                    color: monthsToShow === n ? 'primary.main' : 'text.disabled',
                    '&:hover': { color: monthsToShow === n ? 'primary.main' : 'text.secondary' },
                  }}
                >
                  {n}m
                </Typography>
              </Box>
            ))}
          </Box>
          {activeMacro ? (
            <Box
              onClick={() => onMacroChange?.(null)}
              sx={{ minHeight: 40, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <Typography variant="body2"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                Clear group filter ×
              </Typography>
            </Box>
          ) : activeType !== 'All' && activeType !== 'Income' ? (
            <Box
              onClick={() => onTypeChange?.('All')}
              sx={{ minHeight: 40, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            >
              <Typography variant="body2"
                sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
                Clear filter ×
              </Typography>
            </Box>
          ) : null}
        </Box>
      </Box>

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
                  fill={isFuture ? 'rgba(240,234,214,0.3)' : TICK.fill}
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
              ? (expenseTypes.find(t => t.name === activeType)?.color ?? 'rgba(240,234,214,0.3)')
              : 'rgba(240, 234, 214, 0.3)'
            const refBudget = isTypeFilter ? (budgetByType[activeType] ?? 0) : totalBudget
            if (refBudget <= 0) return null
            // When overrides exist, render as a varying Line; otherwise use a flat ReferenceLine
            if (hasOverrides) return null  // Line rendered below
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
                />
              )
            }}
            cursor={{ fill: 'rgba(240,234,214,0.04)' }}
          />

          {/* Expense type bars — stacked when All; single bar when filtered */}
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
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fillOpacity={entry.isFuture ? 0.35 : 1} />
                ))}
              </Bar>
            ))
          })()}

          {/* Income line */}
          <Line
            type="monotone"
            dataKey="income"
            stroke={INCOME_COLOR}
            strokeWidth={2}
            dot={{ r: 3, fill: INCOME_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
          />

          {/* Budget line — only when monthly overrides exist (otherwise ReferenceLine is used) */}
          {hasOverrides && (() => {
            const isTypeFilter = activeType !== 'All' && activeType !== 'Income'
            const refColor = isTypeFilter
              ? (expenseTypes.find(t => t.name === activeType)?.color ?? 'rgba(240,234,214,0.5)')
              : 'rgba(240, 234, 214, 0.5)'
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
    </Paper>
  )
}
