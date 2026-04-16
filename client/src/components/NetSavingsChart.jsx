import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import api from '../api.js'
import { useC } from '../colors'

const PAST_MONTHS = 6
const FUTURE_MONTHS = 3

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

function addMonthsStr(ym, n) {
  let [y, m] = ym.split('-').map(Number)
  m += n
  while (m > 12) { m -= 12; y++ }
  return `${y}-${String(m).padStart(2, '0')}`
}

function CustomTooltip({ active, payload, monthlyTarget }) {
  const C = useC()
  const NET_POS_COLOR = C.onTrack
  const NET_NEG_COLOR = C.overBudget
  const GOAL_COLOR = C.income
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  if (!entry) return null
  const net = entry.net ?? 0
  const isPos = net >= 0
  return (
    <Box sx={{
      bgcolor: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 1,
      px: 1.5,
      py: 1,
      minWidth: 150,
    }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
        {entry.fullLabel}{entry.isFuture ? ' (projected)' : ''}
      </Typography>
      {entry.isFuture ? (
        <Typography variant="caption" sx={{ display: 'block', color: isPos ? NET_POS_COLOR : NET_NEG_COLOR, fontWeight: 600 }}>
          Projected net: {isPos ? '+' : ''}${net.toFixed(2)}
        </Typography>
      ) : (
        <>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            Income: ${entry.income.toFixed(2)}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            Expenses: ${entry.expenses.toFixed(2)}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: isPos ? NET_POS_COLOR : NET_NEG_COLOR, fontWeight: 600, mt: 0.5 }}>
            Net: {isPos ? '+' : ''}${net.toFixed(2)}
          </Typography>
        </>
      )}
      {monthlyTarget != null && !entry.isFuture && (
        <Typography variant="caption" sx={{ display: 'block', color: GOAL_COLOR, mt: 0.25 }}>
          Goal: ${monthlyTarget.toFixed(2)}
        </Typography>
      )}
    </Box>
  )
}

export default function NetSavingsChart({ refreshKey, monthlyTarget, goals = [] }) {
  const C = useC()
  const NET_POS_COLOR = C.onTrack
  const NET_NEG_COLOR = C.overBudget
  const GOAL_COLOR = C.income
  const TICK = { fill: C.muted, fontSize: 12 }
  const AXIS_LINE = { stroke: C.border }
  const [historicalData, setHistoricalData] = useState([])
  const cur = currentMonth()

  const portfolioAvg = goals.find(g => g.avg_monthly_net != null)?.avg_monthly_net ?? 0
  const activeGoals = goals.filter(
    g => g.goal_type === 'one_time' && !g.completed && g.projected_completion
  )

  useEffect(() => {
    api.get('/savings-goals/net-chart', { params: { months: PAST_MONTHS } }).then(res => {
      setHistoricalData(res.data.map(d => ({
        ...d,
        label: shortLabel(d.month),
        fullLabel: fullLabel(d.month),
        isFuture: false,
      })))
    })
  }, [refreshKey])

  const futureData = Array.from({ length: FUTURE_MONTHS }, (_, i) => {
    const m = addMonthsStr(cur, i + 1)
    return {
      month: m,
      label: shortLabel(m),
      fullLabel: fullLabel(m),
      income: 0,
      expenses: 0,
      net: portfolioAvg,
      isFuture: true,
    }
  })

  const data = [...historicalData, ...futureData]

  const visibleFutureMonths = new Set(futureData.map(d => d.month))
  const goalMarkers = activeGoals.filter(g => visibleFutureMonths.has(g.projected_completion))

  const allVals = data.map(d => d.net).filter(v => v !== 0)
  const maxAbs = allVals.length ? Math.max(...allVals.map(Math.abs)) : 100
  const domainPad = maxAbs * 1.3

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${C.border}`,
        borderRadius: 2,
        p: 2.5,
        mb: 3,
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
        Monthly Net Savings
      </Typography>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={AXIS_LINE}
            tick={({ x, y, payload, index }) => {
              const entry = data[index]
              return (
                <text
                  x={x} y={y + 12}
                  textAnchor="middle"
                  fontSize={12}
                  fill={entry?.isFuture ? C.borderStrong : C.muted}
                >
                  {entry?.isFuture ? `~${payload.value}` : payload.value}
                </text>
              )
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={AXIS_LINE}
            tick={TICK}
            tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
            domain={[-domainPad, domainPad]}
            width={52}
          />
          <Tooltip content={<CustomTooltip monthlyTarget={monthlyTarget} />} cursor={{ fill: C.hover }} />
          <ReferenceLine y={0} stroke={C.refLine} strokeWidth={1} />
          {monthlyTarget != null && monthlyTarget > 0 && (
            <ReferenceLine
              y={monthlyTarget}
              stroke={GOAL_COLOR}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `Goal $${monthlyTarget.toLocaleString()}`, position: 'insideTopRight', fill: GOAL_COLOR, fontSize: 11 }}
            />
          )}
          {goalMarkers.map(g => {
            const entry = data.find(d => d.month === g.projected_completion)
            if (!entry) return null
            return (
              <ReferenceLine
                key={g.id}
                x={entry.label}
                stroke={g.color ?? C.dimText}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: g.name, position: 'insideTopLeft', fill: g.color ?? C.dimText, fontSize: 10 }}
              />
            )
          })}
          <Bar dataKey="net" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.net >= 0 ? NET_POS_COLOR : NET_NEG_COLOR}
                fillOpacity={entry.isFuture ? 0.3 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  )
}
