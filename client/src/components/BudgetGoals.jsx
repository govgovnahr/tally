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
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { ICON_REGISTRY, ICON_OPTIONS } from '../expenseTypes.js'
import ImportBudgetsDialog from './ImportBudgetsDialog.jsx'

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

// ─── Monthly Overrides section ────────────────────────────────────────────────

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthsAhead(count) {
  const result = []
  const now = new Date()
  let y = now.getFullYear()
  let m = now.getMonth() - 1  // start 2 months back
  if (m <= 0) { m += 12; y -= 1 }
  for (let i = 0; i <= count + 2; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const label = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    result.push({ key, label })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

function MonthlyOverrides({ expenseTypes, defaultLimits }) {
  const SELECTABLE_MONTHS = monthsAhead(12)
  const [open, setOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(SELECTABLE_MONTHS[3]?.key ?? SELECTABLE_MONTHS[0].key)
  const [enabled, setEnabled] = useState({})   // typeName → bool
  const [overrideLimits, setOverrideLimits] = useState({})  // typeName → string value
  const [overrideMonths, setOverrideMonths] = useState([])  // months with any override
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Fetch list of months that have overrides
  useEffect(() => {
    api.get('/budgets/monthly-overrides').then(r => setOverrideMonths(r.data)).catch(() => {})
  }, [saved])

  // Load overrides for selected month
  useEffect(() => {
    setSaved(false)
    api.get('/budgets/monthly-overrides', { params: { month: selectedMonth } }).then(r => {
      const existing = Object.fromEntries(r.data.map(b => [b.type, b.monthly_limit]))
      const newEnabled = {}
      const newLimits = {}
      expenseTypes.forEach(t => {
        newEnabled[t.name] = t.name in existing
        newLimits[t.name] = t.name in existing ? String(existing[t.name]) : (defaultLimits[t.name] ?? '')
      })
      setEnabled(newEnabled)
      setOverrideLimits(newLimits)
    }).catch(() => {})
  }, [selectedMonth, expenseTypes])

  async function handleSave() {
    const budgets = expenseTypes
      .filter(t => enabled[t.name] && overrideLimits[t.name] !== '' && Number(overrideLimits[t.name]) >= 0)
      .map(t => ({ type: t.name, monthly_limit: parseFloat(overrideLimits[t.name]) }))
    if (budgets.length === 0) { setSaveError('Enable at least one category override.'); return }
    setSaving(true)
    setSaveError('')
    try {
      await api.post('/budgets/monthly-overrides', { month: selectedMonth, budgets })
      setSaved(true)
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    setSaveError('')
    try {
      await api.delete(`/budgets/monthly-overrides/${selectedMonth}`)
      // Clear all enabled states
      const newEnabled = Object.fromEntries(expenseTypes.map(t => [t.name, false]))
      const newLimits = Object.fromEntries(expenseTypes.map(t => [t.name, defaultLimits[t.name] ?? '']))
      setEnabled(newEnabled)
      setOverrideLimits(newLimits)
      setSaved(true)
    } catch {
      setSaveError('Failed to reset.')
    } finally {
      setSaving(false)
    }
  }

  const hasExistingOverride = overrideMonths.includes(selectedMonth)

  return (
    <Box>
      <Divider sx={{ borderColor: 'rgba(240,234,214,0.08)', my: 3 }} />

      {/* Collapsible header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setOpen(o => !o)}
        sx={{ cursor: 'pointer', userSelect: 'none', mb: open ? 2 : 0 }}
      >
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Monthly Overrides
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Set different budget limits for a specific month.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1}>
          {overrideMonths.length > 0 && (
            <Chip
              label={`${overrideMonths.length} month${overrideMonths.length > 1 ? 's' : ''}`}
              size="small"
              sx={{ bgcolor: 'rgba(240,234,214,0.08)', color: 'text.secondary', fontSize: '0.7rem' }}
            />
          )}
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={open}>
        <Stack spacing={2.5}>
          {/* Month selector */}
          <FormControl size="small" sx={{ width: 220 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              label="Month"
            >
              {SELECTABLE_MONTHS.map(({ key, label }) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    {label}
                    {overrideMonths.includes(key) && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                    )}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Per-category override rows */}
          <Stack spacing={0.75}>
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
                    py: 0.75,
                    borderRadius: 1.5,
                    border: '1px solid rgba(240,234,214,0.08)',
                    opacity: enabled[t.name] ? 1 : 0.55,
                    '&:hover': { bgcolor: 'rgba(240,234,214,0.03)' },
                  }}
                >
                  <Checkbox
                    checked={!!enabled[t.name]}
                    onChange={e => {
                      setEnabled(prev => ({ ...prev, [t.name]: e.target.checked }))
                      setSaved(false)
                    }}
                    size="small"
                    color="primary"
                    sx={{ p: 0.5 }}
                  />
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />
                  {IconComp && <IconComp sx={{ fontSize: 19, color: t.color, flexShrink: 0 }} />}
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, flexGrow: 1 }}>
                    {t.name}
                  </Typography>
                  {!enabled[t.name] && defaultLimits[t.name] && (
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      default ${parseFloat(defaultLimits[t.name]).toFixed(0)}
                    </Typography>
                  )}
                  <TextField
                    type="number"
                    placeholder="No limit"
                    value={overrideLimits[t.name] ?? ''}
                    onChange={e => { setOverrideLimits(prev => ({ ...prev, [t.name]: e.target.value })); setSaved(false) }}
                    disabled={!enabled[t.name]}
                    size="small"
                    variant="outlined"
                    InputProps={{
                      startAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography>,
                    }}
                    inputProps={{ min: '0', step: '0.01', style: { textAlign: 'right', width: 80 } }}
                    sx={{ width: 130, flexShrink: 0 }}
                  />
                </Stack>
              )
            })}
          </Stack>

          {saveError && <Alert severity="error" sx={{ py: 0.5 }}>{saveError}</Alert>}

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {hasExistingOverride ? (
              <Button
                variant="text"
                color="error"
                size="small"
                onClick={handleReset}
                disabled={saving}
              >
                Reset to defaults
              </Button>
            ) : <Box />}
            <Stack direction="row" alignItems="center" gap={2}>
              {saved && (
                <Typography variant="body2" sx={{ color: 'primary.main' }}>
                  {hasExistingOverride ? 'Reset!' : 'Saved!'}
                </Typography>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={saving}
                sx={{ fontWeight: 600 }}
              >
                {saving ? 'Saving…' : 'Save Monthly Overrides'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Collapse>
    </Box>
  )
}

// ─── Macrocategory management section ────────────────────────────────────────

function MacrocategoryManager() {
  const { macrocategories, reloadMacros } = useExpenseTypes()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [newBudget, setNewBudget] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [error, setError] = useState('')

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return setError('Name is required.')
    try {
      await api.post('/macrocategories', { name, color: newColor, budget_limit: newBudget ? parseFloat(newBudget) : null })
      setNewName(''); setNewBudget(''); setError('')
      reloadMacros()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save.')
    }
  }

  async function handleSaveEdit() {
    const name = editName.trim()
    if (!name) return setError('Name is required.')
    try {
      await api.put(`/macrocategories/${editTarget.id}`, {
        name, color: editColor, budget_limit: editBudget ? parseFloat(editBudget) : null,
      })
      setEditTarget(null); setError('')
      reloadMacros()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save.')
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/macrocategories/${id}`)
      reloadMacros()
    } catch { /* ignore */ }
  }

  return (
    <Box>
      <Divider sx={{ borderColor: 'rgba(240,234,214,0.08)', my: 3 }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        onClick={() => setOpen(o => !o)}
        sx={{ cursor: 'pointer', userSelect: 'none', mb: open ? 2 : 0 }}>
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>Macrocategories</Typography>
          <Typography variant="body2" color="text.secondary">Group categories into larger buckets.</Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1}>
          {macrocategories.length > 0 && (
            <Chip label={macrocategories.length} size="small"
              sx={{ bgcolor: 'rgba(240,234,214,0.08)', color: 'text.secondary', fontSize: '0.7rem' }} />
          )}
          <IconButton size="small" sx={{ color: 'text.secondary' }}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={open}>
        <Stack spacing={1.5}>
          {/* Existing macrocategories */}
          {macrocategories.map(m => editTarget?.id === m.id ? (
            <Stack key={m.id} direction="row" alignItems="center" gap={1.5}
              sx={{ px: 1.5, py: 1, borderRadius: 1.5, border: `1px solid ${m.color}`, bgcolor: 'rgba(240,234,214,0.03)' }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: editColor, flexShrink: 0 }} />
              <TextField size="small" value={editName} onChange={e => setEditName(e.target.value)}
                sx={{ flex: 1 }} autoFocus />
              <TextField size="small" value={editBudget} onChange={e => setEditBudget(e.target.value)}
                placeholder="No ceiling" type="number"
                InputProps={{ startAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography> }}
                inputProps={{ min: '0', style: { width: 70 } }} sx={{ width: 110 }} />
              <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ maxWidth: 200 }}>
                {PRESET_COLORS.map(c => (
                  <ColorSwatch key={c} color={c} selected={editColor === c} onClick={() => setEditColor(c)} />
                ))}
              </Stack>
              <Button size="small" variant="contained" onClick={handleSaveEdit}>Save</Button>
              <Button size="small" variant="text" color="inherit" onClick={() => { setEditTarget(null); setError('') }}>Cancel</Button>
            </Stack>
          ) : (
            <Stack key={m.id} direction="row" alignItems="center" gap={1.5}
              sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, border: '1px solid rgba(240,234,214,0.08)',
                '&:hover': { bgcolor: 'rgba(240,234,214,0.03)' } }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', flexGrow: 1 }}>{m.name}</Typography>
              {m.budget_limit > 0 && (
                <Typography variant="caption" color="text.secondary">${m.budget_limit.toFixed(0)} ceiling</Typography>
              )}
              <IconButton size="small"
                onClick={() => { setEditTarget(m); setEditName(m.name); setEditColor(m.color); setEditBudget(m.budget_limit ? String(m.budget_limit) : ''); setError('') }}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => handleDelete(m.id)}
                sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}

          {/* Add new */}
          <Stack direction="row" alignItems="center" gap={1.5}
            sx={{ px: 1.5, py: 1, borderRadius: 1.5, border: '1px dashed rgba(240,234,214,0.2)' }}>
            <TextField size="small" placeholder="Group name" value={newName}
              onChange={e => { setNewName(e.target.value); setError('') }} sx={{ flex: 1 }} />
            <TextField size="small" value={newBudget} onChange={e => setNewBudget(e.target.value)}
              placeholder="No ceiling" type="number"
              InputProps={{ startAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography> }}
              inputProps={{ min: '0', style: { width: 70 } }} sx={{ width: 110 }} />
            <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ maxWidth: 200 }}>
              {PRESET_COLORS.map(c => (
                <ColorSwatch key={c} color={c} selected={newColor === c} onClick={() => setNewColor(c)} />
              ))}
            </Stack>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAdd}>Add</Button>
          </Stack>

          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
        </Stack>
      </Collapse>
    </Box>
  )
}

export default function BudgetGoals({ onSaved }) {
  const { expenseTypes, reloadTypes, macrocategories, macroMap, reloadMacros } = useExpenseTypes()
  const [limits, setLimits] = useState({})
  const [spending, setSpending] = useState({})
  const [loadingBudgets, setLoadingBudgets] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const [showAllCategories, setShowAllCategories] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

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
        <Stack direction="row" gap={1}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<FileUploadIcon />}
            onClick={() => setImportOpen(true)}
            sx={{ fontWeight: 600, flexShrink: 0, color: 'text.secondary', borderColor: 'rgba(240,234,214,0.2)' }}
            size="small"
          >
            Import
          </Button>
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
      </Stack>

      <Divider sx={{ borderColor: 'rgba(240,234,214,0.08)', my: 2.5 }} />

      {/* Category cards */}
      {loadingBudgets ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading…</Typography>
      ) : (
        <form onSubmit={handleSaveBudgets}>
          {(() => {
            const CARD_LIMIT = 4
            const sorted = expenseTypes

            function renderCard(t) {
              const IconComp = ICON_REGISTRY[t.icon]
              const spent = spending[t.name] ?? 0
              const limit = parseFloat(limits[t.name])
              const hasLimit = !isNaN(limit) && limit > 0
              const over = hasLimit && spent > limit
              const pct = hasLimit ? Math.min((spent / limit) * 100, 100) : null
              return (
                <Card
                  key={t.id}
                  elevation={0}
                  sx={{
                    bgcolor: '#2c2f3a',
                    border: '1px solid rgba(240,234,214,0.1)',
                    borderTop: `3px solid ${t.color}`,
                    borderRadius: 2,
                    minWidth: 200,
                    flex: '1 1 200px',
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                      <Stack direction="row" alignItems="center" gap={0.75}>
                        {IconComp && <IconComp sx={{ fontSize: 18, color: t.color }} />}
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {t.name}
                        </Typography>
                      </Stack>
                      <Stack direction="row">
                        <IconButton size="small" onClick={() => { setEditTarget(t); setFormOpen(true) }}
                          title="Edit category" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, p: 0.25 }}>
                          <EditOutlinedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        {!t.is_default && (
                          <IconButton size="small" onClick={() => setDeleteTarget(t)}
                            title="Delete category" sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' }, p: 0.25 }}>
                            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Stack>
                    </Stack>

                    {hasLimit && (
                      <>
                        <Stack direction="row" alignItems="baseline" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" sx={{ color: over ? 'error.main' : 'text.secondary' }}>
                            ${spent.toFixed(2)} spent
                          </Typography>
                          {over ? (
                            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                              +${(spent - limit).toFixed(2)} over
                            </Typography>
                          ) : (
                            <Typography variant="caption" color="text.secondary">/ ${limit.toFixed(0)}</Typography>
                          )}
                        </Stack>
                        <LinearProgress variant="determinate" value={pct}
                          sx={{ height: 4, borderRadius: 2, mb: 1.5, bgcolor: 'rgba(240,234,214,0.08)',
                            '& .MuiLinearProgress-bar': { bgcolor: over ? 'error.main' : t.color, borderRadius: 2 } }} />
                      </>
                    )}

                    <TextField
                      type="number" placeholder="No limit" value={limits[t.name] ?? ''}
                      onChange={e => handleLimitChange(t.name, e.target.value)}
                      size="small" fullWidth
                      InputProps={{ startAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography> }}
                      inputProps={{ min: '0', step: '0.01', style: { textAlign: 'right' } }}
                      sx={{ mb: macrocategories.length > 0 ? 1 : 0 }}
                    />

                    {/* Macrocategory assignment */}
                    {macrocategories.length > 0 && (
                      <FormControl fullWidth size="small">
                        <Select
                          value={t.macrocategory_id ?? ''}
                          onChange={async e => {
                            const newMacroId = e.target.value || null
                            await api.put(`/expense-types/${t.id}`, {
                              name: t.name, color: t.color, icon: t.icon, macrocategory_id: newMacroId,
                            })
                            await reloadTypes()
                          }}
                          displayEmpty
                          sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
                        >
                          <MenuItem value=""><em style={{ fontSize: '0.75rem' }}>— No group —</em></MenuItem>
                          {macrocategories.map(m => (
                            <MenuItem key={m.id} value={m.id} sx={{ fontSize: '0.75rem' }}>
                              <Stack direction="row" alignItems="center" gap={1}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
                                {m.name}
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  </CardContent>
                </Card>
              )
            }

            if (macrocategories.length > 0) {
              // Group cards by macrocategory, limit per group
              const grouped = {}
              macrocategories.forEach(m => { grouped[m.id] = [] })
              const ungrouped = []
              sorted.forEach(t => {
                if (t.macrocategory_id && grouped[t.macrocategory_id]) {
                  grouped[t.macrocategory_id].push(t)
                } else {
                  ungrouped.push(t)
                }
              })
              function groupToggle(key, list) {
                if (list.length <= CARD_LIMIT) return null
                const expanded = expandedGroups.has(key)
                return (
                  <Box sx={{ mt: 1, mb: 1 }}>
                    <Typography variant="caption"
                      onClick={() => setExpandedGroups(prev => {
                        const next = new Set(prev)
                        expanded ? next.delete(key) : next.add(key)
                        return next
                      })}
                      sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'text.primary' } }}>
                      {expanded ? 'Show less ↑' : `Show all ${list.length} ↓`}
                    </Typography>
                  </Box>
                )
              }
              return (
                <Box mb={3}>
                  {macrocategories.map(m => grouped[m.id].length > 0 && (
                    <Box key={m.id} mb={3}>
                      <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
                          {m.name}
                        </Typography>
                        {m.budget_limit > 0 && (
                          <Typography variant="caption" color="text.secondary">— ${m.budget_limit.toFixed(0)} ceiling</Typography>
                        )}
                      </Stack>
                      <Stack direction="row" flexWrap="wrap" gap={2}>
                        {(expandedGroups.has(m.id) ? grouped[m.id] : grouped[m.id].slice(0, CARD_LIMIT)).map(renderCard)}
                      </Stack>
                      {groupToggle(m.id, grouped[m.id])}
                    </Box>
                  ))}
                  {ungrouped.length > 0 && (
                    <Box mb={3}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem', mb: 1.5 }}>
                        Ungrouped
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={2}>
                        {(expandedGroups.has('ungrouped') ? ungrouped : ungrouped.slice(0, CARD_LIMIT)).map(renderCard)}
                      </Stack>
                      {groupToggle('ungrouped', ungrouped)}
                    </Box>
                  )}
                </Box>
              )
            }

            // No macrocategories: flat list with show-all toggle
            const visible = showAllCategories ? sorted : sorted.slice(0, CARD_LIMIT)
            return (
              <>
                <Stack direction="row" flexWrap="wrap" gap={2} mb={3}>
                  {visible.map(renderCard)}
                </Stack>
                {sorted.length > CARD_LIMIT && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" onClick={() => setShowAllCategories(v => !v)}
                      sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'text.primary' } }}>
                      {showAllCategories ? 'Show less ↑' : `Show all ${sorted.length} categories ↓`}
                    </Typography>
                  </Box>
                )}
              </>
            )
          })()}

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

      {/* Monthly overrides */}
      <MonthlyOverrides expenseTypes={expenseTypes} defaultLimits={limits} />

      {/* Macrocategory management */}
      <MacrocategoryManager />

      {/* Dialogs */}
      {importOpen && (
        <ImportBudgetsDialog
          onClose={() => setImportOpen(false)}
          onImported={async () => {
            setImportOpen(false)
            await reloadTypes()
            onSaved()
          }}
        />
      )}
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
