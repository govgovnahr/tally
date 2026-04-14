import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import Chip from '@mui/material/Chip'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import Tooltip from '@mui/material/Tooltip'
import InputAdornment from '@mui/material/InputAdornment'
import Divider from '@mui/material/Divider'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import api from '../api.js'
import NetSavingsChart from './NetSavingsChart.jsx'

const PRIMARY = '#8fb996'
const INCOME_COLOR = '#80cbc4'
const ONE_TIME_COLORS = ['#e8a87c', '#82b4e0', '#c49ee8', '#f0c040', '#e07c7c', '#a0a0a0']

function fmtMonth(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function fmtDeadline(dateStr) {
  if (!dateStr) return null
  const [y, m] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function AllocationChip({ goal }) {
  if (goal.allocation_pct != null)
    return <Chip label={`${goal.allocation_pct}% allocated`} size="small" sx={{ fontSize: '0.72rem', height: 20 }} />
  if (goal.priority != null)
    return <Chip label={`Priority #${goal.priority}`} size="small" sx={{ fontSize: '0.72rem', height: 20 }} />
  return null
}

// ─── Goal Cards ──────────────────────────────────────────────────────────────

function MonthlyGoalCard({ goal, onEdit, onDelete, onPause, onContribute }) {
  const contributed = goal.monthly_contributions ?? 0
  const pct = goal.progress_pct
  const cardColor = goal.color ?? INCOME_COLOR

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid rgba(240,234,214,0.12)',
        borderTop: `3px solid ${cardColor}`,
        borderRadius: 2,
        p: 2.5,
        mb: 2,
        opacity: goal.paused ? 0.65 : 1,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <SavingsOutlinedIcon sx={{ fontSize: 18, color: cardColor }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {goal.name}
          </Typography>
          <Chip label="Monthly" size="small" sx={{ fontSize: '0.72rem', height: 20, color: cardColor, borderColor: cardColor }} variant="outlined" />
          {goal.paused && <Chip label="Paused" size="small" sx={{ fontSize: '0.72rem', height: 20, color: 'text.disabled', borderColor: 'text.disabled' }} variant="outlined" />}
          <AllocationChip goal={goal} />
        </Stack>
        <Stack direction="row">
          <Tooltip title={goal.paused ? 'Resume' : 'Pause'}>
            <IconButton size="small" onClick={onPause} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              {goal.paused ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onEdit} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onDelete} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="baseline" gap={0.5} mb={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
          ${contributed.toFixed(2)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          / ${goal.target.toFixed(2)} this month
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={Math.min(pct, 100)}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(240,234,214,0.08)',
          mb: 1,
          '& .MuiLinearProgress-bar': { bgcolor: cardColor, borderRadius: 3 },
        }}
      />

      <Stack direction="row" justifyContent="flex-end">
        <Button
          size="small"
          variant="outlined"
          onClick={onContribute}
          startIcon={<ReceiptLongOutlinedIcon sx={{ fontSize: '14px !important' }} />}
          sx={{ fontSize: '0.8rem', py: 0.5, px: 1.5, borderColor: cardColor, color: cardColor, '&:hover': { borderColor: cardColor, color: cardColor } }}
        >
          Log contribution
        </Button>
      </Stack>
    </Paper>
  )
}

function OneTimeGoalCard({ goal, color, onEdit, onDelete, onPause, onContribute }) {
  const pct = goal.progress_pct
  const met = pct >= 100

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid rgba(240,234,214,0.12)',
        borderTop: `3px solid ${color}`,
        borderRadius: 2,
        p: 2.5,
        opacity: goal.paused ? 0.65 : 1,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {goal.name}
          </Typography>
          <Stack direction="row" gap={0.5} mt={0.5} flexWrap="wrap">
            {goal.deadline && (
              <Chip
                label={`Due ${fmtDeadline(goal.deadline)}`}
                size="small"
                sx={{ fontSize: '0.72rem', height: 20, color: 'text.secondary', borderColor: 'rgba(240,234,214,0.2)' }}
                variant="outlined"
              />
            )}
            {goal.paused && <Chip label="Paused" size="small" sx={{ fontSize: '0.72rem', height: 20, color: 'text.disabled', borderColor: 'text.disabled' }} variant="outlined" />}
            <AllocationChip goal={goal} />
          </Stack>
        </Box>
        <Stack direction="row">
          <Tooltip title={goal.paused ? 'Resume' : 'Pause'}>
            <IconButton size="small" onClick={onPause} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              {goal.paused ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onEdit} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onDelete} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="baseline" gap={0.5} mb={0.25}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: met ? PRIMARY : 'text.primary' }}>
          ${goal.total_contributions.toFixed(2)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          / ${goal.target.toFixed(2)}
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={Math.min(pct, 100)}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'rgba(240,234,214,0.08)',
          mb: 1.5,
          '& .MuiLinearProgress-bar': { bgcolor: met ? PRIMARY : color, borderRadius: 3 },
        }}
      />

      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" gap={1}>
        <Box>
          {met ? (
            <Typography variant="body2" sx={{ color: PRIMARY }}>Goal met!</Typography>
          ) : goal.projected_completion ? (
            <Typography variant="body2" color="text.secondary">
              Projected: {fmtMonth(goal.projected_completion)}
              {goal.effective_avg_monthly_net > 0 && ` · at $${goal.effective_avg_monthly_net.toFixed(0)}/mo`}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Log contributions to see a projection
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={onContribute}
          startIcon={<ReceiptLongOutlinedIcon sx={{ fontSize: '14px !important' }} />}
          sx={{ flexShrink: 0, fontSize: '0.8rem', py: 0.5, px: 1.5, borderColor: color, color: color, '&:hover': { borderColor: color, color: color } }}
        >
          Log contribution
        </Button>
      </Stack>
    </Paper>
  )
}

// ─── Emergency Fund Goal Card ────────────────────────────────────────────────

function EmergencyFundGoalCard({ goal, color, onEdit, onDelete, onPause, onContribute }) {
  const pct = goal.progress_pct
  const met = pct >= 100

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid rgba(240,234,214,0.12)',
        borderTop: `3px solid ${color}`,
        borderRadius: 2,
        p: 2.5,
        opacity: goal.paused ? 0.65 : 1,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1}>
        <Box>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {goal.name}
            </Typography>
            <Chip label="Emergency Fund" size="small" sx={{ fontSize: '0.72rem', height: 20, color, borderColor: color }} variant="outlined" />
          </Stack>
          <Stack direction="row" gap={0.5} mt={0.5} flexWrap="wrap">
            {goal.months_target && (
              <Typography variant="body2" color="text.secondary">
                {goal.months_target} months of expenses
              </Typography>
            )}
            {goal.paused && <Chip label="Paused" size="small" sx={{ fontSize: '0.72rem', height: 20, color: 'text.disabled', borderColor: 'text.disabled' }} variant="outlined" />}
          </Stack>
        </Box>
        <Stack direction="row">
          <Tooltip title={goal.paused ? 'Resume' : 'Pause'}>
            <IconButton size="small" onClick={onPause} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
              {goal.paused ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onEdit} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onDelete} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="baseline" gap={0.5} mb={0.25}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: met ? PRIMARY : 'text.primary' }}>
          ${goal.total_contributions.toFixed(2)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          / ${goal.target.toFixed(2)}
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={Math.min(pct, 100)}
        sx={{
          height: 6, borderRadius: 3, bgcolor: 'rgba(240,234,214,0.08)', mb: 1.5,
          '& .MuiLinearProgress-bar': { bgcolor: met ? PRIMARY : color, borderRadius: 3 },
        }}
      />

      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" gap={1}>
        <Box>
          {met ? (
            <Typography variant="body2" sx={{ color: PRIMARY }}>Goal met!</Typography>
          ) : goal.projected_completion ? (
            <Typography variant="body2" color="text.secondary">
              Projected: {fmtMonth(goal.projected_completion)}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Log contributions to see a projection
            </Typography>
          )}
        </Box>
        <Button
          size="small" variant="outlined" onClick={onContribute}
          startIcon={<ReceiptLongOutlinedIcon sx={{ fontSize: '14px !important' }} />}
          sx={{ flexShrink: 0, fontSize: '0.8rem', py: 0.5, px: 1.5, borderColor: color, color, '&:hover': { borderColor: color, color } }}
        >
          Log contribution
        </Button>
      </Stack>
    </Paper>
  )
}

// ─── Completed Goal Card ─────────────────────────────────────────────────────

function CompletedGoalCard({ goal, color, onDelete }) {
  const byDeadline = goal.deadline && goal.deadline < new Date().toISOString().slice(0, 10)
  const displayProgress = goal.total_contributions ?? 0
  const pct = goal.progress_pct

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid rgba(240,234,214,0.08)',
        borderTop: `3px solid ${color}`,
        borderRadius: 2,
        p: 2,
        opacity: 0.7,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {goal.name}
          </Typography>
          <Stack direction="row" gap={0.5} mt={0.5}>
            {byDeadline && pct < 100 ? (
              <Chip label="Deadline passed" size="small" sx={{ fontSize: '0.72rem', height: 20, color: 'text.disabled', borderColor: 'text.disabled' }} variant="outlined" />
            ) : (
              <Chip
                icon={<CheckCircleOutlineIcon sx={{ fontSize: '12px !important' }} />}
                label="Goal met"
                size="small"
                sx={{ fontSize: '0.72rem', height: 20, color: PRIMARY, borderColor: PRIMARY }}
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
        <IconButton size="small" onClick={onDelete} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Stack direction="row" alignItems="baseline" gap={0.5} mb={0.75}>
        <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.secondary' }}>
          ${displayProgress.toFixed(2)}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          / ${goal.target.toFixed(2)}
        </Typography>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={Math.min(pct, 100)}
        sx={{
          height: 4,
          borderRadius: 3,
          bgcolor: 'rgba(240,234,214,0.06)',
          '& .MuiLinearProgress-bar': { bgcolor: pct >= 100 ? PRIMARY : color, borderRadius: 3 },
        }}
      />
    </Paper>
  )
}

// ─── Contribution Dialog ─────────────────────────────────────────────────────

function ContributionDialog({ open, onClose, goal, onRefresh }) {
  const [amount, setAmount] = useState('')
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    const a = parseFloat(amount)
    if (!a || a <= 0) { setError('Amount must be greater than 0'); return }
    setSaving(true)
    setError('')
    try {
      await api.post(`/savings-goals/${goal.id}/contributions`, {
        amount: a,
        date: contribDate,
        note: note.trim() || null,
      })
      setAmount('')
      setNote('')
      onRefresh()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(contribId) {
    try {
      await api.delete(`/savings-goals/${goal.id}/contributions/${contribId}`)
      onRefresh()
    } catch {
      // ignore
    }
  }

  const contributions = goal?.contributions ?? []

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)' } }}
    >
      <DialogTitle sx={{ fontWeight: 600, color: 'text.primary' }}>
        Contributions — {goal?.name}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          {contributions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No contributions logged yet.</Typography>
          ) : (
            <Box>
              {contributions.map(c => (
                <Stack
                  key={c.id}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  py={0.75}
                  sx={{ borderBottom: '1px solid rgba(240,234,214,0.08)' }}
                >
                  <Stack>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>${c.amount.toFixed(2)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {fmtDate(c.date)}{c.note ? ` · ${c.note}` : ''}
                    </Typography>
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(c.id)}
                    sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Box>
          )}

          <Divider sx={{ borderColor: 'rgba(240,234,214,0.12)' }} />

          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: 'block', fontWeight: 500 }}>
              Log a contribution
            </Typography>
            <Stack direction="row" gap={1.5} flexWrap="wrap">
              <TextField
                label="Amount ($)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                type="number"
                size="small"
                sx={{ width: 140 }}
                slotProps={{ input: { inputProps: { min: 0, step: 0.01 } } }}
              />
              <TextField
                label="Date"
                value={contribDate}
                onChange={e => setContribDate(e.target.value)}
                type="date"
                size="small"
                sx={{ width: 160 }}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                size="small"
                sx={{ flexGrow: 1, minWidth: 120 }}
              />
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>{error}</Alert>}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="text" color="inherit" onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={saving}
          sx={{ bgcolor: PRIMARY, '&:hover': { bgcolor: '#7aaa84' } }}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Add / Edit Dialog ───────────────────────────────────────────────────────

const GOAL_COLORS = ['#e8a87c', '#82b4e0', '#c49ee8', '#f0c040', '#e07c7c', '#80cbc4', '#8fb996', '#a0a0a0', '#f4a261', '#9b72cf']

function GoalDialog({ open, onClose, onSaved, existing, hasMonthlyGoal, takenPriorities = [], portfolioAvg = null, otherAllocatedPct = 0 }) {
  const isEdit = !!existing
  const [goalType, setGoalType] = useState('one_time')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState(GOAL_COLORS[0])
  const [allocMode, setAllocMode] = useState('none')
  const [allocPct, setAllocPct] = useState('')
  const [allocPriority, setAllocPriority] = useState('')
  const [monthsTarget, setMonthsTarget] = useState('3')
  const [avgExpenses, setAvgExpenses] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setGoalType(existing?.goal_type ?? 'one_time')
      setName(existing?.name ?? '')
      setTarget(existing?.target?.toString() ?? '')
      setDeadline(existing?.deadline ?? '')
      setColor(existing?.color ?? GOAL_COLORS[0])
      setMonthsTarget(existing?.months_target?.toString() ?? '3')
      setError('')
      if (existing?.allocation_pct != null) {
        setAllocMode('pct')
        setAllocPct(existing.allocation_pct.toString())
        setAllocPriority('')
      } else if (existing?.priority != null) {
        setAllocMode('priority')
        setAllocPriority(existing.priority.toString())
        setAllocPct('')
      } else {
        setAllocMode('none')
        setAllocPct('')
        setAllocPriority('')
      }
    }
  }, [open, existing])

  useEffect(() => {
    if (goalType === 'emergency_fund') {
      api.get('/analysis/avg-monthly-expenses').then(r => setAvgExpenses(r.data.avg_monthly_expenses))
    }
  }, [goalType])

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required'); return }

    let t = null
    let months_target_val = null

    if (goalType === 'emergency_fund') {
      const mt = parseInt(monthsTarget)
      if (!mt || mt <= 0) { setError('Months target must be at least 1'); return }
      months_target_val = mt
    } else {
      t = parseFloat(target)
      if (!t || t <= 0) { setError('Target must be greater than 0'); return }
    }

    let allocation_pct = null
    let priority = null
    if (allocMode === 'pct' && goalType !== 'monthly') {
      const pct = parseFloat(allocPct)
      if (isNaN(pct) || pct < 0 || pct > 100) { setError('Percentage must be between 0 and 100'); return }
      allocation_pct = pct
    } else if (allocMode === 'priority' && goalType !== 'monthly') {
      const p = parseInt(allocPriority)
      if (isNaN(p) || p < 1) { setError('Priority must be 1 or greater'); return }
      priority = p
    }

    setSaving(true)
    setError('')
    try {
      const isOneTimeLike = goalType === 'one_time' || goalType === 'emergency_fund'
      const body = {
        goal_type: goalType,
        name: name.trim(),
        target: t,
        deadline: isOneTimeLike && deadline ? deadline : null,
        color,
        allocation_pct: isOneTimeLike ? allocation_pct : null,
        priority: isOneTimeLike ? priority : null,
        months_target: months_target_val,
      }
      if (isEdit) {
        await api.put(`/savings-goals/${existing.id}`, {
          name: body.name,
          target: body.target,
          deadline: body.deadline,
          color,
          allocation_pct: body.allocation_pct,
          priority: body.priority,
          paused: existing.paused ?? false,
          months_target: body.months_target,
        })
      } else {
        await api.post('/savings-goals', body)
      }
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)' } }}
    >
      <DialogTitle sx={{ fontWeight: 600, color: 'text.primary' }}>
        {isEdit ? 'Edit Goal' : 'New Savings Goal'}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2.5} sx={{ mt: 0.5 }}>
          {!isEdit && (
            <Box>
              <FormLabel sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Goal type</FormLabel>
              <RadioGroup value={goalType} onChange={e => setGoalType(e.target.value)} sx={{ mt: 0.5 }}>
                <Tooltip title={hasMonthlyGoal ? 'Monthly goal already set' : ''} placement="top">
                  <FormControlLabel
                    value="monthly"
                    control={<Radio size="small" />}
                    label={<Typography variant="body2">Monthly recurring</Typography>}
                    disabled={hasMonthlyGoal}
                  />
                </Tooltip>
                <FormControlLabel
                  value="one_time"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">One-time goal</Typography>}
                />
                <FormControlLabel
                  value="emergency_fund"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">Emergency fund</Typography>}
                />
              </RadioGroup>
            </Box>
          )}

          <TextField
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            size="small"
            fullWidth
            placeholder={goalType === 'monthly' ? 'e.g. Monthly savings target' : 'e.g. Vacation fund'}
          />

          <Box>
            <FormLabel sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Color</FormLabel>
            <Stack direction="row" gap={0.75} mt={0.75} flexWrap="wrap">
              {GOAL_COLORS.map(c => (
                <Box
                  key={c}
                  onClick={() => setColor(c)}
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    border: color === c ? '2px solid white' : '2px solid transparent',
                    outline: color === c ? `2px solid ${c}` : 'none',
                    transition: 'transform 0.1s',
                    '&:hover': { transform: 'scale(1.15)' },
                  }}
                />
              ))}
            </Stack>
          </Box>

          {goalType === 'emergency_fund' ? (
            <Box>
              <TextField
                label="Months of expenses to cover"
                value={monthsTarget}
                onChange={e => setMonthsTarget(e.target.value)}
                size="small"
                fullWidth
                type="number"
                slotProps={{ input: { inputProps: { min: 1, step: 1 } } }}
              />
              {avgExpenses !== null && (
                <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  {(() => {
                    const mt = parseInt(monthsTarget)
                    if (!mt || mt <= 0) return `3-mo avg: $${avgExpenses.toFixed(0)}/mo`
                    return `≈ $${(mt * avgExpenses).toFixed(0)} target (${mt}× $${avgExpenses.toFixed(0)}/mo avg)`
                  })()}
                </Typography>
              )}
            </Box>
          ) : (
            <TextField
              label="Target amount ($)"
              value={target}
              onChange={e => setTarget(e.target.value)}
              size="small"
              fullWidth
              type="number"
              slotProps={{ input: { inputProps: { min: 0, step: 0.01 } } }}
            />
          )}

          {goalType === 'one_time' && (
            <TextField
              label="Deadline (optional)"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              size="small"
              fullWidth
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
            />
          )}

          {goalType === 'monthly' && (
            <Typography variant="body2" color="text.secondary">
              Progress tracks contributions logged this month toward your target.
            </Typography>
          )}

          {(goalType === 'one_time' || goalType === 'emergency_fund') && !isEdit && (
            <Typography variant="body2" color="text.secondary">
              Progress tracks cumulative contributions logged toward this goal.
            </Typography>
          )}

          {(goalType === 'one_time' || goalType === 'emergency_fund') && (() => {
            const pctNum = parseFloat(allocPct)
            const totalAfterThis = otherAllocatedPct + (isNaN(pctNum) ? 0 : pctNum)
            const overAllocated = allocMode === 'pct' && totalAfterThis > 100
            const remainingPct = Math.max(0, 100 - otherAllocatedPct)
            return (
              <Box>
                <FormLabel sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Allocation</FormLabel>
                <RadioGroup
                  row
                  value={allocMode}
                  onChange={e => setAllocMode(e.target.value)}
                  sx={{ mt: 0.5 }}
                >
                  <FormControlLabel value="none" control={<Radio size="small" />} label={<Typography variant="body2">None</Typography>} />
                  <FormControlLabel value="pct" control={<Radio size="small" />} label={<Typography variant="body2">% Slice</Typography>} />
                  <FormControlLabel value="priority" control={<Radio size="small" />} label={<Typography variant="body2">Priority</Typography>} />
                </RadioGroup>
                {allocMode === 'pct' && (
                  <Box>
                    <TextField
                      label="Percentage of monthly net"
                      value={allocPct}
                      onChange={e => setAllocPct(e.target.value)}
                      type="number"
                      size="small"
                      error={overAllocated}
                      sx={{ mt: 1, width: 200 }}
                      slotProps={{
                        input: {
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                          inputProps: { min: 0, max: 100, step: 1 },
                        },
                      }}
                      helperText={
                        overAllocated
                          ? `Total would be ${totalAfterThis.toFixed(0)}% — exceeds 100%`
                          : otherAllocatedPct > 0
                            ? `Other goals use ${otherAllocatedPct.toFixed(0)}% — ${remainingPct.toFixed(0)}% remaining`
                            : 'Share of monthly net savings allocated to this goal'
                      }
                    />
                    {portfolioAvg != null && portfolioAvg > 0 && !isNaN(pctNum) && pctNum > 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                        3-mo avg net ${portfolioAvg.toFixed(0)}/mo → {pctNum}% = ${(portfolioAvg * pctNum / 100).toFixed(0)}/mo toward this goal
                      </Typography>
                    )}
                    {portfolioAvg != null && portfolioAvg <= 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                        No recent net income data — projection will use contribution history instead.
                      </Typography>
                    )}
                  </Box>
                )}
                {allocMode === 'priority' && (() => {
                  const p = parseInt(allocPriority)
                  const conflict = !isNaN(p) && takenPriorities.includes(p)
                  return (
                    <TextField
                      label="Priority rank"
                      value={allocPriority}
                      onChange={e => setAllocPriority(e.target.value)}
                      type="number"
                      size="small"
                      error={conflict}
                      sx={{ mt: 1, width: 160 }}
                      slotProps={{ input: { inputProps: { min: 1, step: 1 } } }}
                      helperText={
                        conflict
                          ? `Priority ${p} is already taken`
                          : takenPriorities.length > 0
                            ? `Taken: ${takenPriorities.sort((a, b) => a - b).join(', ')}`
                            : '1 = highest priority (funded first from remainder)'
                      }
                    />
                  )
                })()}
                {allocMode !== 'none' && (
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {allocMode === 'pct'
                      ? '% slice goals are funded simultaneously. Unallocated remainder goes to priority goals.'
                      : 'Priority goals are funded sequentially after % slice goals. Lower number = higher priority.'}
                  </Typography>
                )}
              </Box>
            )
          })()}

          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="text" color="inherit" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving} sx={{ bgcolor: PRIMARY, '&:hover': { bgcolor: '#7aaa84' } }}>
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Delete Confirm ──────────────────────────────────────────────────────────

function DeleteConfirmDialog({ open, onClose, onConfirm, goalName }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)' } }}
    >
      <DialogTitle sx={{ fontWeight: 600, color: 'text.primary' }}>Delete goal?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          "{goalName}" and all its contributions will be permanently deleted. Linked expenses will remain in your expense history. This cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="text" color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>Delete</Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SavingsPage() {
  const [goals, setGoals] = useState([])
  const [monthlyTarget, setMonthlyTarget] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [contributingToGoalId, setContributingToGoalId] = useState(null)
  const [completedOpen, setCompletedOpen] = useState(false)

  useEffect(() => {
    api.get('/savings-goals').then(res => setGoals(res.data))
    api.get('/savings-goals/monthly-goal').then(res => setMonthlyTarget(res.data.target))
  }, [refreshKey])

  function refresh() { setRefreshKey(k => k + 1) }

  const monthlyGoal = goals.find(g => g.goal_type === 'monthly') ?? null
  const oneTimeGoals = goals.filter(g => (g.goal_type === 'one_time' || g.goal_type === 'emergency_fund') && !g.completed)
  const completedGoals = goals.filter(g => (g.goal_type === 'one_time' || g.goal_type === 'emergency_fund') && g.completed)
  const hasMonthlyGoal = !!monthlyGoal

  // Priorities currently in use by active goals (excluding the one being edited)
  const takenPriorities = goals
    .filter(g => g.priority != null && !g.completed && g.id !== editingGoal?.id)
    .map(g => g.priority)

  const portfolioAvg = goals.find(g => g.avg_monthly_net != null)?.avg_monthly_net ?? null

  const otherAllocatedPct = goals
    .filter(g => g.allocation_pct != null && !g.completed && g.id !== editingGoal?.id)
    .reduce((sum, g) => sum + g.allocation_pct, 0)

  const activeContribGoal = contributingToGoalId
    ? goals.find(g => g.id === contributingToGoalId) ?? null
    : null

  async function handleDelete() {
    if (!deletingGoal) return
    await api.delete(`/savings-goals/${deletingGoal.id}`)
    setDeletingGoal(null)
    refresh()
  }

  async function handlePause(goalId) {
    await api.patch(`/savings-goals/${goalId}/pause`)
    refresh()
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" mb={3} gap={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1.2rem', sm: '1.4rem' } }}>
            Savings Goals
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Track monthly net savings and long-term targets
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setEditingGoal(null); setDialogOpen(true) }}
          sx={{ fontWeight: 600, bgcolor: PRIMARY, '&:hover': { bgcolor: '#7aaa84' }, flexShrink: 0 }}
        >
          Add Goal
        </Button>
      </Stack>

      {/* Net chart */}
      <NetSavingsChart refreshKey={refreshKey} monthlyTarget={monthlyTarget} goals={goals} />

      {/* Monthly goal */}
      {monthlyGoal && (
        <MonthlyGoalCard
          goal={monthlyGoal}
          onEdit={() => { setEditingGoal(monthlyGoal); setDialogOpen(true) }}
          onDelete={() => setDeletingGoal(monthlyGoal)}
          onPause={() => handlePause(monthlyGoal.id)}
          onContribute={() => setContributingToGoalId(monthlyGoal.id)}
        />
      )}

      {/* Active one-time goals */}
      {oneTimeGoals.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 2,
            mt: monthlyGoal ? 2 : 0,
          }}
        >
          {oneTimeGoals.map((goal, i) => {
            const color = goal.color ?? ONE_TIME_COLORS[i % ONE_TIME_COLORS.length]
            const commonProps = {
              key: goal.id, goal, color,
              onEdit: () => { setEditingGoal(goal); setDialogOpen(true) },
              onDelete: () => setDeletingGoal(goal),
              onPause: () => handlePause(goal.id),
              onContribute: () => setContributingToGoalId(goal.id),
            }
            return goal.goal_type === 'emergency_fund'
              ? <EmergencyFundGoalCard {...commonProps} />
              : <OneTimeGoalCard {...commonProps} />
          })}
        </Box>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <Accordion
          expanded={completedOpen}
          onChange={() => setCompletedOpen(o => !o)}
          elevation={0}
          sx={{
            mt: 3,
            bgcolor: 'transparent',
            border: '1px solid rgba(240,234,214,0.12)',
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}>
            <Stack direction="row" alignItems="center" gap={1}>
              <CheckCircleOutlineIcon sx={{ fontSize: 16, color: PRIMARY }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                Completed ({completedGoals.length})
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 1.5,
              }}
            >
              {completedGoals.map((goal, i) => (
                <CompletedGoalCard
                  key={goal.id}
                  goal={goal}
                  color={goal.color ?? ONE_TIME_COLORS[i % ONE_TIME_COLORS.length]}
                  onDelete={() => setDeletingGoal(goal)}
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Empty state */}
      {goals.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            border: '1px solid rgba(240,234,214,0.12)',
            borderRadius: 2,
            py: 8,
            textAlign: 'center',
          }}
        >
          <SavingsOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="body2" color="text.secondary">
            No savings goals yet. Add one to start tracking.
          </Typography>
        </Paper>
      )}

      <GoalDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); refresh() }}
        existing={editingGoal}
        hasMonthlyGoal={hasMonthlyGoal && !editingGoal}
        takenPriorities={takenPriorities}
        portfolioAvg={portfolioAvg}
        otherAllocatedPct={otherAllocatedPct}
      />

      <DeleteConfirmDialog
        open={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        onConfirm={handleDelete}
        goalName={deletingGoal?.name ?? ''}
      />

      <ContributionDialog
        open={!!contributingToGoalId}
        onClose={() => setContributingToGoalId(null)}
        goal={activeContribGoal}
        onRefresh={refresh}
      />
    </Box>
  )
}
