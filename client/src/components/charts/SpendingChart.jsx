import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useExpenseTypes } from '../../ExpenseTypesContext.jsx'
import { useC } from '../../colors'

function formatDollar(v) {
  return `$${v.toLocaleString()}`
}

function CustomTooltip({ active, payload, label }) {
  const C = useC()
  if (!active || !payload?.length) return null
  const spent = payload.find(p => p.dataKey === 'spent')
  const budget = payload.find(p => p.dataKey === 'budget')
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ backgroundColor: C.surfacePopup, border: `1px solid ${C.border}` }}
    >
      <p className="text-sm font-semibold mb-1">{label}</p>
      {spent && (
        <span className="block text-xs" style={{ color: spent.fill }}>
          Spent: {formatDollar(spent.value)}
        </span>
      )}
      {budget && (
        <span className="block text-xs" style={{ color: C.muted }}>
          {budget.value > 0 ? `Budget: ${formatDollar(budget.value)}` : 'No limit set'}
        </span>
      )}
    </div>
  )
}

export default function SpendingChart({ summary, budgets }) {
  const C = useC()
  const TICK = { fill: C.muted, fontSize: 12 }
  const AXIS_LINE = { stroke: C.border }
  const OVER_COLOR = C.overBudget
  const { expenseTypes } = useExpenseTypes()

  if (Object.keys(budgets).length === 0) return null

  const chartData = expenseTypes
    .filter(t => summary.some(s => s.type === t.name) || (budgets[t.name] ?? 0) > 0)
    .map(t => {
      const s = summary.find(x => x.type === t.name)
      const budget = budgets[t.name] ?? 0
      const spent = s?.total ?? 0
      return { type: t.name, spent, budget, color: t.color, isOver: budget > 0 && spent > budget }
    })

  if (chartData.length === 0) return null

  const xMax = Math.max(...chartData.map(d => Math.max(d.spent, d.budget)), 1) * 1.1

  return (
    <div>
      <p className="text-sm font-medium mb-2" style={{ color: C.muted }}>Spent vs Budget</p>
      <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 38)}>
        <BarChart
          layout="vertical"
          data={chartData}
          barCategoryGap="28%"
          barGap={3}
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            domain={[0, xMax]}
            tickFormatter={formatDollar}
            tick={TICK}
            axisLine={AXIS_LINE}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="type"
            width={110}
            tick={TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: C.hover }} />
          <Bar dataKey="budget" name="budget" radius={[0, 3, 3, 0]} maxBarSize={10}>
            {chartData.map(entry => (
              <Cell key={entry.type} fill={C.border} />
            ))}
          </Bar>
          <Bar dataKey="spent" name="spent" radius={[0, 3, 3, 0]} maxBarSize={10}>
            {chartData.map(entry => (
              <Cell key={entry.type} fill={entry.isOver ? OVER_COLOR : entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
