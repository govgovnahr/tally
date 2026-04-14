import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import api from '../api.js'

const PRIMARY = '#8fb996'

// Returns the goal to auto-assign to:
// 1. Lowest priority number among prioritized goals
// 2. Otherwise first active goal (API returns by created_at ASC)
// 3. null if no goals
function getDefaultGoal(goals) {
  if (goals.length === 0) return null
  const prioritized = goals.filter(g => g.priority != null).sort((a, b) => a.priority - b.priority)
  return prioritized[0] ?? goals[0]
}

function autoLabel(defaultGoal) {
  if (!defaultGoal) return ''
  if (defaultGoal.priority != null) return `Auto-assigned · priority #${defaultGoal.priority} goal`
  return 'Auto-assigned · first active goal'
}

// expenses: [{id, name, amount, date}]
// onClose: dismiss without saving
// onDone: called after assignments are saved
export default function SavingsLinkModal({ open, expenses, onClose, onDone }) {
  const [goals, setGoals] = useState([])
  const [defaultGoal, setDefaultGoal] = useState(null)
  const [assignments, setAssignments] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    api.get('/savings-goals').then(res => {
      const active = res.data.filter(g => !g.completed)
      setGoals(active)
      const def = getDefaultGoal(active)
      setDefaultGoal(def)
      const init = {}
      for (const exp of expenses) {
        init[exp.id] = def
          ? { mode: 'existing', goalId: def.id, newName: exp.name, newTarget: '', auto: true }
          : { mode: 'new', goalId: '', newName: exp.name, newTarget: '', auto: false }
      }
      setAssignments(init)
    })
  }, [open, expenses])

  function patch(expId, delta) {
    setAssignments(prev => ({ ...prev, [expId]: { ...prev[expId], ...delta } }))
  }

  function handleSelectChange(expId, val) {
    if (val === 'new') patch(expId, { mode: 'new', goalId: '', auto: false })
    else patch(expId, { mode: 'existing', goalId: val, auto: false })
  }

  async function handleConfirm() {
    setSaving(true)
    setError('')
    try {
      for (const exp of expenses) {
        const a = assignments[exp.id]
        if (!a || a.mode === 'skip') continue

        let goalId = a.goalId

        if (a.mode === 'new') {
          if (!a.newName.trim()) { setError('Goal name is required'); setSaving(false); return }
          const t = parseFloat(a.newTarget)
          if (!t || t <= 0) { setError('Target amount must be greater than 0'); setSaving(false); return }
          const res = await api.post('/savings-goals', {
            goal_type: 'one_time',
            name: a.newName.trim(),
            target: t,
          })
          goalId = res.data.id
        }

        if (!goalId) continue

        await api.post(`/savings-goals/${goalId}/contributions`, {
          amount: exp.amount,
          date: exp.date,
          expense_id: exp.id,
        })
      }
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = Object.values(assignments).filter(a => a.mode !== 'skip').length

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)' } }}
    >
      <DialogTitle sx={{ fontWeight: 600, color: 'text.primary' }}>
        Assign Savings Transactions
      </DialogTitle>
      <DialogContent>
        {defaultGoal ? (
          <Alert
            icon={<AutoAwesomeIcon fontSize="small" />}
            severity="info"
            sx={{ mb: 2, '& .MuiAlert-message': { fontSize: '0.8rem' } }}
          >
            Pre-assigned to <strong>{defaultGoal.name}</strong>
            {defaultGoal.priority != null
              ? ` (priority #${defaultGoal.priority} goal)`
              : goals.length === 1 ? ' (your only active goal)' : ' (first active goal)'
            }. Change or clear any below.
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {expenses.length === 1
              ? 'This transaction was categorized as Savings. Assign it to a goal to track progress.'
              : `${expenses.length} transactions were categorized as Savings. Assign each to a goal.`}
          </Typography>
        )}

        <Stack gap={1.5}>
          {expenses.map(exp => {
            const a = assignments[exp.id] ?? { mode: 'skip', goalId: '', newName: exp.name, newTarget: '', auto: false }
            const selectValue = a.mode === 'skip' ? 'skip' : a.mode === 'new' ? 'new' : a.goalId
            return (
              <Box
                key={exp.id}
                sx={{
                  border: `1px solid ${a.auto ? `${PRIMARY}40` : 'rgba(240,234,214,0.12)'}`,
                  borderRadius: 1.5,
                  p: 1.5,
                  transition: 'border-color 0.15s',
                }}
              >
                <Stack direction="row" alignItems="center" gap={0.75} mb={1.25}>
                  <SavingsOutlinedIcon sx={{ fontSize: 15, color: PRIMARY }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{exp.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>
                    ${exp.amount.toFixed(2)} · {exp.date}
                  </Typography>
                </Stack>

                <FormControl size="small" fullWidth>
                  <InputLabel>Assign to goal</InputLabel>
                  <Select
                    value={selectValue}
                    label="Assign to goal"
                    onChange={e => handleSelectChange(exp.id, e.target.value)}
                  >
                    {goals.map(g => (
                      <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                    ))}
                    <MenuItem value="new">+ Create new goal…</MenuItem>
                  </Select>
                </FormControl>

                {a.auto && (
                  <Stack direction="row" alignItems="center" gap={0.5} mt={0.75}>
                    <AutoAwesomeIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                    <Typography variant="caption" color="text.disabled">
                      {autoLabel(defaultGoal)}
                    </Typography>
                  </Stack>
                )}

                {a.mode === 'new' && (
                  <Stack direction="row" gap={1.5} mt={1.25}>
                    <TextField
                      label="Goal name"
                      value={a.newName}
                      onChange={e => patch(exp.id, { newName: e.target.value })}
                      size="small"
                      sx={{ flexGrow: 1 }}
                    />
                    <TextField
                      label="Target ($)"
                      value={a.newTarget}
                      onChange={e => patch(exp.id, { newTarget: e.target.value })}
                      type="number"
                      size="small"
                      sx={{ width: 120 }}
                      slotProps={{ input: { inputProps: { min: 0, step: 0.01 } } }}
                    />
                  </Stack>
                )}
              </Box>
            )
          })}
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 1.5, py: 0.5 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="text" color="inherit" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={saving}
          sx={{ bgcolor: PRIMARY, '&:hover': { bgcolor: '#7aaa84' } }}
        >
          {saving ? 'Saving…' : `Assign ${expenses.length}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
