import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { useC } from '../colors'

function formatDollar(v) {
  return `$${v.toLocaleString()}`
}

function CustomTooltip({ active, payload, label }) {
  const C = useC()
  if (!active || !payload?.length) return null
  const spent = payload.find(p => p.dataKey === 'spent')
  const budget = payload.find(p => p.dataKey === 'budget')
  return (
    <Box sx={{
      bgcolor: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 1,
      px: 1.5,
      py: 1,
    }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
        {label}
      </Typography>
      {spent && (
        <Typography variant="caption" sx={{ display: 'block', color: spent.fill }}>
          Spent: {formatDollar(spent.value)}
        </Typography>
      )}
      {budget && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {budget.value > 0 ? `Budget: ${formatDollar(budget.value)}` : 'No limit set'}
        </Typography>
      )}
    </Box>
  )
}

export default function SpendingChart({ summary, budgets }) {
  const C = useC()
  const TICK = { fill: C.muted, fontSize: 12 }
  const AXIS_LINE = { stroke: C.border }
  const OVER_COLOR = C.overBudget
  const { expenseTypes } = useExpenseTypes()

  if (Object.keys(budgets).length === 0) return null

  // Use all types that have spending or a budget set — fixes the silent bug where
  // custom/user-defined types were silently omitted when iterating a static array.
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
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
        Spent vs Budget
      </Typography>
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
    </Box>
  )
}
