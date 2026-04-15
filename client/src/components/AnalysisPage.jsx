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
} from 'recharts'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { ICON_REGISTRY } from '../expenseTypes.js'
import MonthSelector from './MonthSelector.jsx'

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

const STATUS_COLORS = {
  on_track: '#8fb996',
  at_risk: '#f0c040',
  over_budget: '#e07c7c',
  no_budget: 'rgba(240,234,214,0.25)',
}

const STATUS_LABELS = {
  on_track: 'On track',
  at_risk: 'At risk',
  over_budget: 'Over budget',
  no_budget: 'No budget',
}

const TREND_ICON = {
  up: <TrendingUpIcon sx={{ fontSize: 16, color: '#e07c7c' }} />,
  down: <TrendingDownIcon sx={{ fontSize: 16, color: '#8fb996' }} />,
  flat: <TrendingFlatIcon sx={{ fontSize: 16, color: 'text.disabled' }} />,
}

// Shared toggle button style with adequate tap targets
const toggleSx = {
  '& .MuiToggleButton-root': {
    color: 'text.secondary',
    borderColor: 'rgba(240,234,214,0.15)',
    fontSize: '0.8rem',
    py: 0.75,
    px: 1.5,
    minHeight: 36,
    '&.Mui-selected': { color: 'primary.main', bgcolor: 'rgba(143,185,150,0.1)' },
  },
}

function StatusChip({ status }) {
  return (
    <Chip
      label={STATUS_LABELS[status]}
      size="small"
      sx={{ fontSize: '0.72rem', height: 22, bgcolor: STATUS_COLORS[status], color: '#22252e', fontWeight: 600, flexShrink: 0 }}
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
      sx={{ bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)', borderRadius: 2, p: { xs: 2, sm: 3 } }}
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
              const typeEntry = typeMap[cat.type] || { color: '#a0a0a0', icon: null }
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
                  <Box sx={{ position: 'relative', height: 6, borderRadius: 3, bgcolor: 'rgba(240,234,214,0.08)', overflow: 'hidden' }}>
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
                        bgcolor: actuallyOver ? '#e07c7c' : typeEntry.color,
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
  const { typeMap } = useExpenseTypes()
  const [data, setData] = useState([])

  useEffect(() => {
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
      sx={{ bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)', borderRadius: 2, p: { xs: 2, sm: 3 }, mt: 3 }}
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,234,214,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#a0a0a0', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <YAxis type="category" dataKey="type" tick={{ fill: '#c0c0c0', fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip
                contentStyle={{ background: '#2c2f3a', border: '1px solid rgba(240,234,214,0.12)', borderRadius: 8, fontSize: 13 }}
                labelStyle={{ color: '#f0ead6' }}
                formatter={(val, name) => [`$${Number(val).toFixed(2)}`, name]}
              />
              <Bar dataKey="avg" name="Avg spend" fill="#82b4e0" radius={[0, 3, 3, 0]} barSize={12} />
              <Bar dataKey="budget" name="Budget" fill="rgba(240,234,214,0.12)" radius={[0, 3, 3, 0]} barSize={12} />
            </ComposedChart>
          </ResponsiveContainer>

          {offenders.length > 0 && (
            <>
              <Divider sx={{ borderColor: 'rgba(240,234,214,0.08)', my: 2.5 }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
                Most often over budget
              </Typography>
              <Stack spacing={1.5}>
                {offenders.map(d => {
                  const typeEntry = typeMap[d.type] || { color: '#a0a0a0', icon: null }
                  const IconComp = typeEntry.icon ? ICON_REGISTRY[typeEntry.icon] : null
                  const freqColor = d.frequency_pct >= 66 ? '#e07c7c' : d.frequency_pct >= 33 ? '#f0c040' : '#8fb996'
                  return (
                    <Box
                      key={d.type}
                      sx={{ px: 2, py: 1.5, borderRadius: 2, bgcolor: 'rgba(240,234,214,0.03)', border: '1px solid rgba(240,234,214,0.07)' }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" mb={1} gap={0.5}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          {IconComp && <IconComp sx={{ fontSize: 18, color: typeEntry.color }} />}
                          <Typography variant="body1" sx={{ fontWeight: 500, color: 'text.primary' }}>{d.type}</Typography>
                          {TREND_ICON[d.trend]}
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={2}>
                          <Typography variant="body2" color="text.secondary">
                            {d.months_over}/{d.months_total} months over
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#e07c7c', fontWeight: 600 }}>
                            +${d.avg_overage.toFixed(0)} avg
                          </Typography>
                        </Stack>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={d.frequency_pct}
                        sx={{ height: 5, borderRadius: 2.5, bgcolor: 'rgba(240,234,214,0.08)',
                          '& .MuiLinearProgress-bar': { bgcolor: freqColor, borderRadius: 2.5 } }}
                      />
                    </Box>
                  )
                })}
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
      sx={{ bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)', borderRadius: 2, p: { xs: 2, sm: 3 }, mt: 3 }}
    >
      <Stack direction="row" alignItems="flex-start" gap={1} mb={0.5}>
        <WarningAmberIcon sx={{ fontSize: 20, color: '#f0c040', mt: '2px' }} />
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
            const typeEntry = typeMap[e.type] || { color: '#a0a0a0' }
            const severity = e.z_score >= 3 ? '#e07c7c' : e.z_score >= 2 ? '#f0c040' : '#82b4e0'
            return (
              <Box
                key={e.id}
                sx={{ px: 2, py: 1.5, borderRadius: 2, border: '1px solid rgba(240,234,214,0.07)', bgcolor: 'rgba(240,234,214,0.02)' }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={0.5}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {e.name}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ color: 'text.primary', flexShrink: 0 }}>
                    ${e.amount.toFixed(2)}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0, flex: 1 }}>
                    <Chip
                      label={e.type}
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 20, bgcolor: `${typeEntry.color}22`, color: typeEntry.color, border: `1px solid ${typeEntry.color}44`, flexShrink: 0 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fmtDate(e.date)} · avg ${e.category_avg.toFixed(2)}
                    </Typography>
                  </Stack>
                  <Chip
                    label={`+${e.pct_above_avg}%`}
                    size="small"
                    sx={{ fontSize: '0.72rem', height: 22, bgcolor: severity, color: '#22252e', fontWeight: 700, flexShrink: 0, ml: 1 }}
                  />
                </Stack>
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
  const [data, setData] = useState([])

  useEffect(() => {
    api.get('/analysis/month-over-month', { params: { months } }).then(r => setData(r.data))
  }, [months])

  const chartData = data.map(d => ({ ...d, label: shortMonth(d.month) }))
  const avgSpent = data.length > 0 ? data.reduce((s, d) => s + d.total_spent, 0) / data.length : 0

  return (
    <Paper
      elevation={0}
      sx={{ bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)', borderRadius: 2, p: { xs: 2, sm: 3 }, mt: 3, mb: 3 }}
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
              sx={{ fontSize: '0.75rem', height: 24, color: up ? '#e07c7c' : '#8fb996', borderColor: up ? '#e07c7c' : '#8fb996' }}
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,234,214,0.06)" />
            <XAxis dataKey="label" tick={{ fill: '#c0c0c0', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#a0a0a0', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#2c2f3a', border: '1px solid rgba(240,234,214,0.12)', borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: '#f0ead6' }}
              formatter={(val, name) => [`$${Number(val).toFixed(2)}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#a0a0a0' }} />
            <Bar dataKey="total_spent" name="Spent" fill="#82b4e0" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="total_income" name="Income" stroke="#80cbc4" strokeWidth={2} dot={{ r: 3, fill: '#80cbc4' }} />
            <Line type="monotone" dataKey="net" name="Net" stroke="#8fb996" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2, fill: '#8fb996' }} />
            {avgSpent > 0 && (
              <ReferenceLine y={avgSpent} stroke="rgba(240,234,214,0.3)" strokeDasharray="4 4"
                label={{ value: 'avg', fill: '#a0a0a0', fontSize: 11, position: 'insideTopRight' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Paper>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
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
