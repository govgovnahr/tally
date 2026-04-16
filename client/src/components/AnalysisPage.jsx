import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
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
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { ICON_REGISTRY } from '../expenseTypes.js'
import MonthSelector from './MonthSelector.jsx'
import { useC } from '../colors'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shortMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short' })
}

function fmtDate(d) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_LABELS = {
  on_track: 'On track',
  at_risk: 'At risk',
  over_budget: 'Over budget',
  no_budget: 'No budget',
}

function useStatusColors() {
  const C = useC()
  return {
    on_track:    C.onTrack,
    at_risk:     C.atRisk,
    over_budget: C.overBudget,
    no_budget:   C.noBudget,
  }
}

function useToggleSx() {
  const C = useC()
  return {
    '& .MuiToggleButton-root': {
      color: 'text.secondary',
      borderColor: C.borderLight,
      fontSize: '0.8rem',
      py: 0.75,
      px: 1.5,
      minHeight: 36,
      '&.Mui-selected': { color: 'primary.main', bgcolor: C.primaryTint },
    },
  }
}

function StatusChip({ status }) {
  const C = useC()
  const STATUS_COLORS = useStatusColors()
  return (
    <Chip
      label={STATUS_LABELS[status]}
      size="small"
      sx={{ fontSize: '0.72rem', height: 22, bgcolor: STATUS_COLORS[status], color: C.surface, fontWeight: 600, flexShrink: 0 }}
    />
  )
}

function ShowMoreToggle({ shown, total, label, onToggle }) {
  return (
    <Box
      onClick={onToggle}
      sx={{ minHeight: 40, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>
        {shown ? 'Show less ↑' : `Show all ${total} ${label} ↓`}
      </Typography>
    </Box>
  )
}

// ─── Pacing Section ───────────────────────────────────────────────────────────

function PacingSection({ month, onMonthChange }) {
  const C = useC()
  const STATUS_COLORS = useStatusColors()
  const toggleSx = useToggleSx()
  const { typeMap } = useExpenseTypes()
  const [lookbackMonths, setLookbackMonths] = useState(3)
  const [data, setData] = useState(null)
  const [showAllPacing, setShowAllPacing] = useState(false)

  useEffect(() => {
    setData(null)
    setShowAllPacing(false)
    api.get('/analysis/pacing', { params: { month, lookback_months: lookbackMonths } })
      .then(r => setData(r.data))
  }, [month, lookbackMonths])

  const isFuture = data && data.days_elapsed === 0 && !data.is_current_month
  const isPast = data && !data.is_current_month && !isFuture

  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: 'background.paper', border: `1px solid ${C.border}`, borderRadius: 2, p: { xs: 2, sm: 3 } }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2.5} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '1rem', sm: '1.1rem' } }}>
            Budget Pacing
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {isPast
              ? 'Actual spend vs budget for this month'
              : 'Projected end-of-month spend using historical daily rate'}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
          {data && !isFuture && (
            <Typography variant="body2" color="text.secondary">
              Day {data.days_elapsed} of {data.days_in_month}
            </Typography>
          )}
          {!isPast && (
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">History:</Typography>
              <ToggleButtonGroup
                value={lookbackMonths}
                exclusive
                onChange={(_, v) => { if (v) setLookbackMonths(v) }}
                size="small"
                sx={toggleSx}
              >
                <ToggleButton value={1}>1M</ToggleButton>
                <ToggleButton value={3}>3M</ToggleButton>
                <ToggleButton value={6}>6M</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          )}
        </Stack>
      </Stack>

      <MonthSelector selectedMonth={month} onMonthChange={onMonthChange} refreshKey={0} />

      {isFuture ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          Select a past or current month to see pacing.
        </Typography>
      ) : !data ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading…</Typography>
      ) : data.categories.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          No expenses recorded for this month.
        </Typography>
      ) : (
        <Stack spacing={2} mt={1.5}>
          {[...data.categories]
            .filter(c => c.spent > 0 || c.projected_spend != null)
            .sort((a, b) => {
              const order = { over_budget: 0, at_risk: 1, on_track: 2, no_budget: 3 }
              return (order[a.status] ?? 4) - (order[b.status] ?? 4)
            })
            .slice(0, showAllPacing ? undefined : 3)
            .map(cat => {
              const typeEntry = typeMap[cat.type] || { color: C.dimText, icon: null }
              const IconComp = typeEntry.icon ? ICON_REGISTRY[typeEntry.icon] : null
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
                <Box key={cat.type}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                    gap={{ xs: 0.5, sm: 1 }}
                    mb={0.75}
                  >
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      {IconComp && <IconComp sx={{ fontSize: 18, color: typeEntry.color }} />}
                      <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 500 }}>{cat.type}</Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
                      <Typography variant="body2" color="text.secondary">
                        <strong style={{ color: 'inherit' }}>${cat.spent.toFixed(2)}</strong> spent
                        {!isPast && cat.projected_spend != null && (
                          <> · <strong>${cat.projected_spend.toFixed(2)}</strong> projected</>
                        )}
                        {cat.budget_limit ? ` / $${cat.budget_limit.toFixed(0)} budget` : ''}
                      </Typography>
                      {!isPast && cat.status !== 'no_budget' && (
                        <StatusChip status={cat.status} />
                      )}
                    </Stack>
                  </Stack>
                  <Box sx={{ position: 'relative', height: 6, borderRadius: 3, bgcolor: C.hoverStrong, overflow: 'hidden' }}>
                    {ghostWidth !== null && ghostWidth > 0 && (
                      <Box sx={{
                        position: 'absolute', top: 0, left: `${spentPct}%`,
                        height: '100%', width: `${ghostWidth}%`,
                        bgcolor: statusColor, opacity: 0.4, borderRadius: 3,
                      }} />
                    )}
                    {spentPct !== null && (
                      <Box sx={{
                        position: 'absolute', top: 0, left: 0, height: '100%',
                        width: `${spentPct}%`,
                        bgcolor: actuallyOver ? C.overBudget : typeEntry.color,
                        borderRadius: 3,
                      }} />
                    )}
                  </Box>
                </Box>
              )
            })}
          {(() => {
            const total = data.categories.filter(c => c.spent > 0 || c.projected_spend != null).length
            return total > 3 ? (
              <ShowMoreToggle shown={showAllPacing} total={total} label="categories" onToggle={() => setShowAllPacing(v => !v)} />
            ) : null
          })()}
        </Stack>
      )}
    </Paper>
  )
}

// ─── Budget Performance Section ───────────────────────────────────────────────

function BudgetPerformanceSection({ months }) {
  const C = useC()
  const TREND_ICON = {
    up:   <TrendingUpIcon sx={{ fontSize: 16, color: C.trendUp }} />,
    down: <TrendingDownIcon sx={{ fontSize: 16, color: C.trendDown }} />,
    flat: <TrendingFlatIcon sx={{ fontSize: 16, color: 'text.disabled' }} />,
  }
  const { typeMap } = useExpenseTypes()
  const [data, setData] = useState([])
  const [showAllOffenders, setShowAllOffenders] = useState(false)

  useEffect(() => {
    setShowAllOffenders(false)
    api.get('/analysis/category-stats', { params: { months } }).then(r => setData(r.data))
  }, [months])

  const chartData = [...data]
    .sort((a, b) => b.avg_monthly - a.avg_monthly)
    .slice(0, 10)
    .map(d => ({ type: d.type, avg: d.avg_monthly, budget: d.budget_limit ?? null }))

  const offenders = data.filter(d => d.months_over > 0 && d.budget_limit)

  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: 'background.paper', border: `1px solid ${C.border}`, borderRadius: 2, p: { xs: 2, sm: 3 }, mt: 3 }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
        Budget Performance
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2.5}>
        Average monthly spend vs budget over the selected period
      </Typography>

      {data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No expense data.</Typography>
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
              <Divider sx={{ borderColor: C.hoverStrong, my: 2.5 }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
                Most often over budget
              </Typography>
              <Stack spacing={1.5}>
                {(showAllOffenders ? offenders : offenders.slice(0, 3)).map(d => {
                  const typeEntry = typeMap[d.type] || { color: C.dimText, icon: null }
                  const IconComp = typeEntry.icon ? ICON_REGISTRY[typeEntry.icon] : null
                  const freqColor = d.frequency_pct >= 66 ? C.overBudget : d.frequency_pct >= 33 ? C.atRisk : C.onTrack
                  return (
                    <Box
                      key={d.type}
                      sx={{ px: 2, py: 1.5, borderRadius: 2, bgcolor: 'rgba(240,234,214,0.03)', border: '1px solid rgba(240,234,214,0.07)' }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1} flexWrap="wrap" gap={1}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          {IconComp && <IconComp sx={{ fontSize: 18, color: typeEntry.color }} />}
                          <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>{d.type}</Typography>
                          {TREND_ICON[d.trend]}
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={2}>
                          <Typography variant="body2" color="text.secondary">
                            {d.months_over}/{d.months_total} months over
                          </Typography>
                          <Typography variant="body2" sx={{ color: C.overBudget, fontWeight: 600 }}>
                            +${d.avg_overage.toFixed(0)} avg
                          </Typography>
                        </Stack>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={d.frequency_pct}
                        sx={{ height: 5, borderRadius: 2.5, bgcolor: C.hoverStrong,
                          '& .MuiLinearProgress-bar': { bgcolor: freqColor, borderRadius: 2.5 } }}
                      />
                    </Box>
                  )
                })}
                {offenders.length > 3 && (
                  <ShowMoreToggle shown={showAllOffenders} total={offenders.length} label="offenders" onToggle={() => setShowAllOffenders(v => !v)} />
                )}
              </Stack>
            </>
          )}
        </>
      )}
    </Paper>
  )
}

// ─── Outliers Section ─────────────────────────────────────────────────────────

function OutliersSection({ months }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAllOutliers, setShowAllOutliers] = useState(false)

  useEffect(() => {
    setLoading(true)
    setShowAllOutliers(false)
    api.get('/analysis/outliers', { params: { months } })
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [months])

  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: 'background.paper', border: `1px solid ${C.border}`, borderRadius: 2, p: { xs: 2, sm: 3 }, mt: 3 }}
    >
      <Stack direction="row" alignItems="flex-start" gap={1} mb={0.5}>
        <WarningAmberIcon sx={{ fontSize: 20, color: C.atRisk, mt: '2px' }} />
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', fontSize: { xs: '1rem', sm: '1.1rem' } }}>
          Unusual Expenses
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={2.5}>
        Individual expenses significantly above their category average
      </Typography>

      {loading ? (
        <Typography variant="body2" color="text.secondary">Loading…</Typography>
      ) : data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No unusual expenses detected in the selected period. Need at least 3 expenses per category to compute.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {(showAllOutliers ? data : data.slice(0, 3)).map(e => {
            const typeEntry = typeMap[e.type] || { color: C.dimText }
            const severity = e.z_score >= 3 ? C.overBudget : e.z_score >= 2 ? C.atRisk : C.spent
            const typChipSx = { fontSize: '0.72rem', height: 22, bgcolor: `${typeEntry.color}22`, color: typeEntry.color, border: `1px solid ${typeEntry.color}44` }
            const pctChipSx = { fontSize: '0.72rem', height: 22, bgcolor: severity, color: C.surface, fontWeight: 700 }
            return (
              <Box
                key={e.id}
                sx={{ px: 2, py: 1.5, borderRadius: 2, border: '1px solid rgba(240,234,214,0.07)', bgcolor: 'rgba(240,234,214,0.02)' }}
              >
                {/* Desktop: name on top row (left-aligned), chip+date below — avoids fixed-width spacing */}
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary', wordBreak: 'break-word' }}>
                      {e.name}
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.5 }}>
                      <Chip label={e.type} size="small" sx={typChipSx} />
                      <Typography variant="body2" color="text.secondary">
                        {fmtDate(e.date)} · avg ${e.category_avg.toFixed(2)} in this category
                      </Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      ${e.amount.toFixed(2)}
                    </Typography>
                    <Chip label={`+${e.pct_above_avg}%`} size="small" sx={pctChipSx} />
                  </Stack>
                </Stack>

                {/* Mobile: ExpenseList-style card — name+amount row, then chip+date row */}
                <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>
                      {e.name}
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={0.75} sx={{ flexShrink: 0 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: 'text.primary' }}>
                        ${e.amount.toFixed(2)}
                      </Typography>
                      <Chip label={`+${e.pct_above_avg}%`} size="small" sx={pctChipSx} />
                    </Stack>
                  </Stack>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
                    <Chip label={e.type} size="small" sx={typChipSx} />
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(e.date)} · avg ${e.category_avg.toFixed(2)}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            )
          })}
          {data.length > 3 && (
            <ShowMoreToggle shown={showAllOutliers} total={data.length} label="expenses" onToggle={() => setShowAllOutliers(v => !v)} />
          )}
        </Stack>
      )}
    </Paper>
  )
}

// ─── Month-over-Month Section ─────────────────────────────────────────────────

function MonthOverMonthSection({ months }) {
  const C = useC()
  const [data, setData] = useState([])

  useEffect(() => {
    api.get('/analysis/month-over-month', { params: { months } }).then(r => setData(r.data))
  }, [months])

  const chartData = data.map(d => ({ ...d, label: shortMonth(d.month) }))
  const avgSpent = data.length > 0 ? data.reduce((s, d) => s + d.total_spent, 0) / data.length : 0

  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: 'background.paper', border: `1px solid ${C.border}`, borderRadius: 2, p: { xs: 2, sm: 3 }, mt: 3, mb: 3 }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5, fontSize: { xs: '1rem', sm: '1.1rem' } }}>
        Monthly Trends
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Total spending, income, and net by month
      </Typography>

      <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
        {data.map(d => {
          if (d.mom_change_pct === null) return null
          const up = d.mom_change_pct > 0
          return (
            <Chip
              key={d.month}
              label={`${shortMonth(d.month)} ${up ? '+' : ''}${d.mom_change_pct.toFixed(1)}%`}
              size="small"
              sx={{ fontSize: '0.75rem', height: 24, color: up ? C.overBudget : C.onTrack, borderColor: up ? C.overBudget : C.onTrack }}
              variant="outlined"
            />
          )
        })}
      </Stack>

      {data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No data.</Typography>
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
            <Bar dataKey="total_spent" name="Spent" fill={C.netPositive} radius={[3, 3, 0, 0]} >
              {chartData.map(entry => (
                <Cell key={entry.id} fill={entry.net > 0 ? C.netPositive : C.netNegative}/>
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
    </Paper>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const toggleSx = useToggleSx()
  const [pacingMonth, setPacingMonth] = useState(currentMonth())
  const [historyMonths, setHistoryMonths] = useState(6)

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" mb={3} gap={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1.2rem', sm: '1.4rem' } }}>
            Spending Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Pacing, budget performance, outliers, and trends
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={historyMonths}
          exclusive
          onChange={(_, v) => { if (v) setHistoryMonths(v) }}
          size="small"
          sx={toggleSx}
        >
          <ToggleButton value={3}>3M</ToggleButton>
          <ToggleButton value={6}>6M</ToggleButton>
          <ToggleButton value={12}>12M</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <PacingSection month={pacingMonth} onMonthChange={setPacingMonth} />
      <BudgetPerformanceSection months={historyMonths} />
      <OutliersSection months={historyMonths} />
      <MonthOverMonthSection months={historyMonths} />
    </Box>
  )
}
