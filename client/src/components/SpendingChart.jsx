import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { EXPENSE_TYPES } from '../expenseTypes.js'

const TICK = { fill: 'rgba(240, 234, 214, 0.55)', fontSize: 12 }
const AXIS_LINE = { stroke: 'rgba(240, 234, 214, 0.12)' }
const OVER_COLOR = '#e07c7c'

function formatDollar(v) {
  return `$${v.toLocaleString()}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const spent = payload.find(p => p.dataKey === 'spent')
  const budget = payload.find(p => p.dataKey === 'budget')
  return (
    <Box sx={{
      bgcolor: '#22252e',
      border: '1px solid rgba(240,234,214,0.12)',
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
  if (Object.keys(budgets).length === 0) return null

  const chartData = EXPENSE_TYPES.map(({ type, color }) => {
    const s = summary.find(x => x.type === type)
    const budget = budgets[type] ?? 0
    const spent = s?.total ?? 0
    return { type, spent, budget, color, isOver: budget > 0 && spent > budget }
  })

  const xMax = Math.max(...chartData.map(d => Math.max(d.spent, d.budget)), 1) * 1.1

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
        Spent vs Budget
      </Typography>
      <ResponsiveContainer width="100%" height={230}>
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
            width={90}
            tick={TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(240,234,214,0.04)' }} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={v => (
              <span style={{ color: 'rgba(240,234,214,0.55)', fontSize: 12 }}>
                {v === 'spent' ? 'Spent' : 'Budget'}
              </span>
            )}
          />
          <Bar dataKey="budget" name="budget" radius={[0, 3, 3, 0]} maxBarSize={10}>
            {chartData.map(entry => (
              <Cell key={entry.type} fill="rgba(240,234,214,0.12)" />
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
