import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import api from '../api.js'
import { qk } from '../queryKeys.js'
import { useC } from '../colors'

const PAST_MONTHS = 6

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
    <div
      className="rounded-lg px-3 py-2 min-w-[150px]"
      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
    >
      <p className="text-sm font-semibold mb-1">
        {entry.fullLabel}{entry.isFuture ? ' (projected)' : ''}
      </p>
      {entry.isFuture ? (
        <span className="block text-xs font-semibold" style={{ color: isPos ? NET_POS_COLOR : NET_NEG_COLOR }}>
          Projected net: {isPos ? '+' : ''}${net.toFixed(2)}
        </span>
      ) : (
        <>
          <span className="block text-xs" style={{ color: C.muted }}>
            Income: ${entry.income.toFixed(2)}
          </span>
          <span className="block text-xs" style={{ color: C.muted }}>
            Expenses: ${entry.expenses.toFixed(2)}
          </span>
          <span className="block text-xs font-semibold mt-1" style={{ color: isPos ? NET_POS_COLOR : NET_NEG_COLOR }}>
            Net: {isPos ? '+' : ''}${net.toFixed(2)}
          </span>
        </>
      )}
      {monthlyTarget != null && !entry.isFuture && (
        <span className="block text-xs mt-0.5" style={{ color: GOAL_COLOR }}>
          Goal: ${monthlyTarget.toFixed(2)}
        </span>
      )}
    </div>
  )
}

export default function NetSavingsChart({ monthlyTarget, goals = [] }) {
  const C = useC()
  const NET_POS_COLOR = C.onTrack
  const NET_NEG_COLOR = C.overBudget
  const GOAL_COLOR = C.income
  const TICK = { fill: C.muted, fontSize: 12 }
  const AXIS_LINE = { stroke: C.border }
  const [hiddenGoalIds, setHiddenGoalIds] = useState(new Set())
  const cur = currentMonth()

  const { data: rawHistorical = [] } = useQuery({
    queryKey: qk.savingsGoalsNetChart(PAST_MONTHS),
    queryFn: () => api.get('/savings-goals/net-chart', { params: { months: PAST_MONTHS } }).then(r => r.data),
    staleTime: 2 * 60_000,
  })
  const historicalData = rawHistorical.map(d => ({
    ...d, label: shortLabel(d.month), fullLabel: fullLabel(d.month), isFuture: false,
  }))

  function toggleGoal(id) {
    setHiddenGoalIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const portfolioAvg = goals.find(g => g.avg_monthly_net != null)?.avg_monthly_net ?? 0
  const activeGoals = goals.filter(
    g => (g.goal_type === 'one_time' || g.goal_type === 'emergency_fund') && !g.completed && g.projected_completion
  )
  const FUTURE_MONTHS = Math.min(12, Math.max(3, ...activeGoals.map(g => {
    const [gy, gm] = g.projected_completion.split('-').map(Number)
    const [cy, cm] = cur.split('-').map(Number)
    return (gy - cy) * 12 + (gm - cm)
  }), 0))


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
  const allVisibleMonths = new Set(data.map(d => d.month))

  const visibleGoals = activeGoals.filter(g => !hiddenGoalIds.has(g.id))
  const projectionMarkers = visibleGoals.filter(g => allVisibleMonths.has(g.projected_completion))
  const deadlineMarkers = visibleGoals.filter(g => {
    const dm = g.deadline?.slice(0, 7)
    return dm && g.projected_completion > dm && allVisibleMonths.has(dm)
  })

  const allVals = data.map(d => d.net).filter(v => v !== 0)
  const maxAbs = allVals.length ? Math.max(...allVals.map(Math.abs)) : 100
  const domainPad = maxAbs * 1.3

  return (
    <div
      className="rounded-2xl p-6 mb-6"
      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>
          Monthly Net Savings
        </p>
        {activeGoals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeGoals.map(g => {
              const hidden = hiddenGoalIds.has(g.id)
              const goalColor = g.color ?? C.primary
              return (
                <button key={g.id} type="button" onClick={() => toggleGoal(g.id)}
                  className="text-[10px] px-2 py-0.5 rounded-full border bg-transparent cursor-pointer transition-all duration-150"
                  style={{
                    color: hidden ? C.muted : goalColor,
                    borderColor: hidden ? C.border : goalColor,
                    opacity: hidden ? 0.5 : 1,
                  }}>
                  {g.name}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="month"
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
                  {entry?.isFuture ? `~${shortLabel(payload.value)}` : shortLabel(payload.value)}
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
          {deadlineMarkers.map(g => (
            <ReferenceLine
              key={`due-${g.id}`}
              x={g.deadline.slice(0, 7)}
              stroke={C.overBudget}
              strokeWidth={1.5}
              label={{ value: `${g.name} due`, position: 'insideBottomLeft', fill: C.overBudget, fontSize: 10 }}
            />
          ))}
          {projectionMarkers.map(g => {
            const isAtRisk = g.deadline && g.projected_completion > g.deadline.slice(0, 7)
            return (
              <ReferenceLine
                key={`proj-${g.id}`}
                x={g.projected_completion}
                stroke={g.color ?? C.dimText}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: isAtRisk ? `~${g.name}` : g.name, position: 'insideTopLeft', fill: g.color ?? C.dimText, fontSize: 10 }}
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
    </div>
  )
}
