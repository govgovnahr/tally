import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { ICON_REGISTRY, ICON_OPTIONS } from '../expenseTypes.js'

// ─── Shared constants ────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#e8a87c', '#82b4e0', '#c49ee8', '#f0c040', '#80cbc4', '#a0a0a0',
  '#ef9a9a', '#90caf9', '#a5d6a7', '#ffcc80', '#ce93d8', '#f48fb1',
  '#ff8a65', '#4db6ac', '#7986cb', '#aed581',
]

// ─── Category form dialog (add / edit) ───────────────────────────────────────

function ColorSwatch({ color, selected, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        bgcolor: color,
        cursor: 'pointer',
        border: selected ? '3px solid white' : '3px solid transparent',
        boxSizing: 'border-box',
        outline: selected ? `2px solid ${color}` : 'none',
        '&:hover': { opacity: 0.85 },
      }}
    />
  )
}

function CategoryFormDialog({ open, onClose, onSaved, existing }) {
  const isEditing = Boolean(existing)
  const [name, setName] = useState(existing?.name ?? '')
  const [color, setColor] = useState(existing?.color ?? PRESET_COLORS[0])
  const [icon, setIcon] = useState(existing?.icon ?? ICON_OPTIONS[0].key)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required.')
    setLoading(true)
    try {
      if (isEditing) {
        await api.put(`/expense-types/${existing.id}`, { name: name.trim(), color, icon })
      } else {
        await api.post('/expense-types', { name: name.trim(), color, icon })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save category.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: { bgcolor: 'background.paper', border: '1px solid rgba(240, 234, 214, 0.12)' },
      }}
    >
      <DialogTitle sx={{ color: 'text.primary', fontWeight: 600 }}>
        {isEditing ? 'Edit Category' : 'Add Category'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Name"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              autoFocus
              fullWidth
              size="small"
              variant="outlined"
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Icon
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {ICON_OPTIONS.map(({ key, Icon, label }) => (
                  <Tooltip key={key} title={label} placement="top">
                    <Box
                      onClick={() => setIcon(key)}
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        border: icon === key
                          ? `2px solid ${color}`
                          : '2px solid rgba(240,234,214,0.12)',
                        bgcolor: icon === key ? 'rgba(240,234,214,0.06)' : 'transparent',
                        '&:hover': { bgcolor: 'rgba(240,234,214,0.06)' },
                      }}
                    >
                      <Icon sx={{ fontSize: 19, color: icon === key ? color : 'text.secondary' }} />
                    </Box>
                  </Tooltip>
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Color
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {PRESET_COLORS.map(c => (
                  <ColorSwatch key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
                ))}
              </Stack>
              <Stack direction="row" alignItems="center" gap={1} mt={1.5}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: color,
                    border: '1px solid rgba(240,234,214,0.2)',
                    flexShrink: 0,
                  }}
                />
                <TextField
                  size="small"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  placeholder="#rrggbb"
                  inputProps={{ maxLength: 7 }}
                  sx={{ width: 110 }}
                  variant="outlined"
                />
              </Stack>
            </Box>
            {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="text" color="inherit" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary" disabled={loading}>
            {loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Category')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

// ─── Delete confirmation dialog ───────────────────────────────────────────────

function DeleteDialog({ open, onClose, onDeleted, type, otherTypes }) {
  const [reassignTo, setReassignTo] = useState('')
  const [error, setError] = useState('')
  const [needsReassign, setNeedsReassign] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const params = reassignTo ? { reassign_to: reassignTo } : {}
      await api.delete(`/expense-types/${type.id}`, { params })
      onDeleted()
      onClose()
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      if (err.response?.status === 409) {
        setNeedsReassign(true)
        setError(detail)
      } else {
        setError(detail || 'Failed to delete category.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: { bgcolor: 'background.paper', border: '1px solid rgba(240, 234, 214, 0.12)' },
      }}
    >
      <DialogTitle sx={{ color: 'text.primary', fontWeight: 600 }}>
        Delete "{type?.name}"?
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {!needsReassign && (
            <Typography variant="body2" color="text.secondary">
              This will permanently delete the category and remove its budget goal.
            </Typography>
          )}
          {needsReassign && (
            <>
              <Alert severity="warning" sx={{ py: 0.5 }}>{error}</Alert>
              <FormControl fullWidth size="small">
                <InputLabel>Reassign expenses to</InputLabel>
                <Select
                  value={reassignTo}
                  onChange={e => setReassignTo(e.target.value)}
                  label="Reassign expenses to"
                >
                  {otherTypes.map(t => (
                    <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
          {error && !needsReassign && (
            <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="text" color="inherit" onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDelete}
          disabled={loading || (needsReassign && !reassignTo)}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Main combined page ───────────────────────────────────────────────────────

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function BudgetGoals({ onSaved }) {
  const { expenseTypes, reloadTypes } = useExpenseTypes()
  const [limits, setLimits] = useState({})
  const [spending, setSpending] = useState({})
  const [loadingBudgets, setLoadingBudgets] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Reload budget limits whenever the type list changes (renames, adds, deletes)
  useEffect(() => {
    if (expenseTypes.length === 0) return
    setLoadingBudgets(true)
    setSaved(false)
    Promise.all([
      api.get('/budgets'),
      api.get('/expenses/summary', { params: { month: currentMonth() } }),
    ]).then(([budgetsRes, summaryRes]) => {
      const fromApi = Object.fromEntries(
        budgetsRes.data.map(b => [b.type, b.monthly_limit > 0 ? String(b.monthly_limit) : ''])
      )
      const defaults = Object.fromEntries(expenseTypes.map(t => [t.name, '']))
      setLimits({ ...defaults, ...fromApi })
      setSpending(Object.fromEntries(summaryRes.data.map(r => [r.type, r.total])))
    }).finally(() => setLoadingBudgets(false))
  }, [expenseTypes])

  function handleLimitChange(typeName, value) {
    setLimits(prev => ({ ...prev, [typeName]: value }))
    setSaved(false)
    setSaveError('')
  }

  async function handleSaveBudgets(e) {
    e.preventDefault()
    const budgets = expenseTypes
      .filter(t => limits[t.name] !== '' && Number(limits[t.name]) >= 0)
      .map(t => ({ type: t.name, monthly_limit: parseFloat(limits[t.name]) }))

    if (budgets.length === 0) return setSaveError('Enter at least one budget limit.')

    setSaving(true)
    try {
      await api.post('/budgets', budgets)
      setSaved(true)
      onSaved()
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTypeSaved() {
    await reloadTypes()
    onSaved()
  }

  async function handleTypeDeleted() {
    await reloadTypes()
    onSaved()
  }

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid rgba(240, 234, 214, 0.12)',
        borderRadius: 2,
        p: { xs: 3, sm: 4 },
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
            Budget Goals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Set monthly limits and manage your spending categories.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => { setEditTarget(null); setFormOpen(true) }}
          sx={{ fontWeight: 600, flexShrink: 0 }}
          size="small"
        >
          Add Category
        </Button>
      </Stack>

      <Divider sx={{ borderColor: 'rgba(240,234,214,0.08)', my: 2.5 }} />

      {/* Column labels */}
      <Stack direction="row" alignItems="center" sx={{ px: 1, mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
          Category
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ width: 140, textAlign: 'right', pr: 8 }}>
          Monthly limit
        </Typography>
      </Stack>

      {/* Category rows */}
      {loadingBudgets ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading…</Typography>
      ) : (
        <form onSubmit={handleSaveBudgets}>
          <Stack spacing={0.75} mb={3}>
            {expenseTypes.map(t => {
              const IconComp = ICON_REGISTRY[t.icon]
              return (
                <Stack
                  key={t.id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    border: '1px solid rgba(240,234,214,0.08)',
                    '&:hover': { bgcolor: 'rgba(240,234,214,0.03)' },
                  }}
                >
                  {/* Color dot */}
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />

                  {/* Icon */}
                  {IconComp && (
                    <IconComp sx={{ fontSize: 19, color: t.color, flexShrink: 0 }} />
                  )}

                  {/* Name */}
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.primary', fontWeight: 500, flexGrow: 1 }}
                  >
                    {t.name}
                  </Typography>

                  {/* Over-budget indicator */}
                  {(() => {
                    const spent = spending[t.name] ?? 0
                    const limit = parseFloat(limits[t.name])
                    if (!isNaN(limit) && limit > 0 && spent > limit) {
                      return (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600, flexShrink: 0 }}>
                          ${(spent - limit).toFixed(2)} over
                        </Typography>
                      )
                    }
                    return null
                  })()}

                  {/* Budget input */}
                  <TextField
                    type="number"
                    placeholder="No limit"
                    value={limits[t.name] ?? ''}
                    onChange={e => handleLimitChange(t.name, e.target.value)}
                    size="small"
                    variant="outlined"
                    InputProps={{
                      startAdornment: (
                        <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography>
                      ),
                    }}
                    inputProps={{ min: '0', step: '0.01', style: { textAlign: 'right', width: 80 } }}
                    sx={{ width: 130, flexShrink: 0 }}
                  />

                  {/* Edit */}
                  <IconButton
                    size="small"
                    onClick={() => { setEditTarget(t); setFormOpen(true) }}
                    title="Edit category"
                    sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>

                  {/* Delete */}
                  <IconButton
                    size="small"
                    onClick={() => setDeleteTarget(t)}
                    title="Delete category"
                    sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )
            })}
          </Stack>

          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

          <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2}>
            {saved && (
              <Typography variant="body2" sx={{ color: 'primary.main' }}>
                Changes saved!
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={saving}
              sx={{ fontWeight: 600 }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </Stack>
        </form>
      )}

      {/* Dialogs */}
      {formOpen && (
        <CategoryFormDialog
          open
          onClose={() => setFormOpen(false)}
          onSaved={handleTypeSaved}
          existing={editTarget}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          open
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleTypeDeleted}
          type={deleteTarget}
          otherTypes={expenseTypes.filter(t => t.id !== deleteTarget.id)}
        />
      )}
    </Paper>
  )
}
