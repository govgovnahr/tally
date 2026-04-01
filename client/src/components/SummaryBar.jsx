import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import api from '../api.js'
import { TYPE_MAP } from '../expenseTypes.js'
import SpendingChart from './SpendingChart.jsx'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel() {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export default function SummaryBar({ refreshKey }) {
  const [summary, setSummary] = useState([])
  const [budgets, setBudgets] = useState({})

  useEffect(() => {
    const month = currentMonth()
    Promise.all([
      api.get('/expenses/summary', { params: { month } }),
      api.get('/budgets'),
    ]).then(([summaryRes, budgetsRes]) => {
      setSummary(summaryRes.data)
      const budgetMap = {}
      budgetsRes.data.forEach(b => { budgetMap[b.type] = b.monthly_limit })
      setBudgets(budgetMap)
    })
  }, [refreshKey])

  const totalSpent = summary.reduce((sum, s) => sum + s.total, 0)
  const totalBudget = Object.values(budgets).reduce((sum, v) => sum + v, 0)
  const grandPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : null
  const grandOver = totalBudget > 0 && totalSpent > totalBudget

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid rgba(240, 234, 214, 0.12)',
        borderRadius: 2,
        p: 3,
        mb: 3,
      }}
    >
      {/* Header row */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {monthLabel()}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1 }}>
            ${totalSpent.toFixed(2)}
          </Typography>
          {totalBudget > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              of ${totalBudget.toFixed(2)} budget
            </Typography>
          )}
        </Box>
        {grandPct !== null && (
          <Box sx={{ width: 200, pt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={grandPct}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'rgba(240,234,214,0.1)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: grandOver ? 'error.main' : 'primary.main',
                  borderRadius: 4,
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{
                mt: 0.5,
                display: 'block',
                textAlign: 'right',
                color: grandOver ? 'error.main' : 'text.secondary',
              }}
            >
              {grandOver ? 'Over budget' : `${Math.round(grandPct)}%`}
            </Typography>
          </Box>
        )}
      </Stack>

      {/* Category cards + chart */}
      <Stack direction="row" alignItems="flex-start" gap={3} flexWrap="wrap">
        <Stack direction="row" flexWrap="wrap" gap={2} sx={{ flex: 1, minWidth: 280 }}>
        {summary.map(s => {
          const config = TYPE_MAP[s.type] || { color: '#a0a0a0', Icon: null }
          const limit = budgets[s.type]
          const pct = limit > 0 ? Math.min((s.total / limit) * 100, 100) : null
          const over = limit > 0 && s.total > limit

          return (
            <Card
              key={s.type}
              elevation={0}
              sx={{
                bgcolor: '#2c2f3a',
                border: '1px solid rgba(240, 234, 214, 0.1)',
                borderTop: `3px solid ${config.color}`,
                borderRadius: 2,
                minWidth: 150,
                flex: '1 1 150px',
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
                  {config.Icon && (
                    <config.Icon sx={{ fontSize: 18, color: config.color }} />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {s.type}
                  </Typography>
                </Stack>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: over ? 'error.main' : config.color,
                    lineHeight: 1.2,
                    mb: 0.5,
                  }}
                >
                  ${s.total.toFixed(2)}
                  {limit > 0 && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 400 }}
                    >
                      {' '}/ ${limit.toFixed(0)}
                    </Typography>
                  )}
                </Typography>
                {pct !== null && (
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      mb: 0.75,
                      bgcolor: 'rgba(240,234,214,0.08)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: over ? 'error.main' : config.color,
                        borderRadius: 2,
                      },
                    }}
                  />
                )}
                <Typography variant="caption" color="text.secondary">
                  {s.count} {s.count === 1 ? 'expense' : 'expenses'}
                  {over && (
                    <Typography component="span" variant="caption" color="error.main">
                      {' '}&middot; Over!
                    </Typography>
                  )}
                </Typography>
              </CardContent>
            </Card>
          )
        })}
          {summary.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              No expenses this month yet. Add one below!
            </Typography>
          )}
        </Stack>

        <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 340 } }}>
          <SpendingChart summary={summary} budgets={budgets} />
        </Box>
      </Stack>
    </Paper>
  )
}
