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
import { useMenuStyles } from '../menuStyles.js'
import { useC, TYPE_PALETTE } from '../colors'

// ─── Shared constants ────────────────────────────────────────────────────────

const PRESET_COLORS = TYPE_PALETTE

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
  const C = useC()
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
        sx: { bgcolor: 'background.paper' },
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
                          : `2px solid ${C.border}`,
                        bgcolor: icon === key ? C.hoverMed : 'transparent',
                        '&:hover': { bgcolor: C.hoverMed },
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
                    border: `1px solid ${C.borderMed}`,
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
  const { DROPDOWN_MENU_PROPS, DROPDOWN_ITEM_SX } = useMenuStyles()
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
        sx: { bgcolor: 'background.paper' },
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
                  {...DROPDOWN_MENU_PROPS}
                >
                  {otherTypes.map(t => (
                    <MenuItem key={t.id} value={t.id} sx={DROPDOWN_ITEM_SX}>{t.name}</MenuItem>
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

function buildOverrideMonthOptions() {
  const result = []
  const now = new Date()
  let y = now.getFullYear(), m = now.getMonth() - 10
  while (m <= 0) { m += 12; y-- }
  for (let i = 0; i < 14; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    result.push({ key, label: new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }) })
    if (++m > 12) { m = 1; y++ }
  }
  return result
}
const OVERRIDE_MONTH_OPTIONS = buildOverrideMonthOptions()

function MonthlyOverrides({ expenseTypes, defaultLimits, onChanged }) {
  const C = useC()
  const { DROPDOWN_MENU_PROPS, DROPDOWN_ITEM_SX } = useMenuStyles()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState({})
  const [overrideLimits, setOverrideLimits] = useState({})
  const [savedOverrides, setSavedOverrides] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // All months that have any override (for past-months section)
  const [overrideMonths, setOverrideMonths] = useState([])
  const [expandedPastMonth, setExpandedPastMonth] = useState(null)
  const [pastMonthData, setPastMonthData] = useState({})  // month → [{type, monthly_limit}]

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
      setSavedOverrides(new Set(Object.keys(existing)))
    }).catch(() => {})
  }, [expenseTypes, selectedMonth])

  useEffect(() => {
    api.get('/budgets/monthly-overrides').then(r => setOverrideMonths(r.data)).catch(() => {})
  }, [saved])

  const otherMonths = overrideMonths.filter(m => m !== selectedMonth).sort((a, b) => b.localeCompare(a))

  function expandPastMonth(month) {
    if (expandedPastMonth === month) { setExpandedPastMonth(null); return }
    setExpandedPastMonth(month)
    if (!pastMonthData[month]) {
      api.get('/budgets/monthly-overrides', { params: { month } })
        .then(r => setPastMonthData(prev => ({ ...prev, [month]: r.data })))
        .catch(() => {})
    }
  }

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
      setSavedOverrides(new Set(budgets.map(b => b.type)))
      onChanged?.()
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteType(typeName) {
    try {
      await api.delete(`/budgets/monthly-overrides/${selectedMonth}/${encodeURIComponent(typeName)}`)
      setSavedOverrides(prev => { const next = new Set(prev); next.delete(typeName); return next })
      setEnabled(prev => ({ ...prev, [typeName]: false }))
      setOverrideLimits(prev => ({ ...prev, [typeName]: defaultLimits[typeName] ?? '' }))
      onChanged?.()
    } catch {
      setSaveError('Failed to delete override.')
    }
  }

  async function handleReset() {
    setSaving(true)
    setSaveError('')
    try {
      await api.delete(`/budgets/monthly-overrides/${selectedMonth}`)
      const newEnabled = Object.fromEntries(expenseTypes.map(t => [t.name, false]))
      const newLimits = Object.fromEntries(expenseTypes.map(t => [t.name, defaultLimits[t.name] ?? '']))
      setEnabled(newEnabled)
      setOverrideLimits(newLimits)
      setSavedOverrides(new Set())
      onChanged?.()
    } catch {
      setSaveError('Failed to reset.')
    } finally {
      setSaving(false)
    }
  }

  const hasExistingOverride = savedOverrides.size > 0

  return (
    <Box>
      <Divider sx={{ borderColor: C.hoverStrong, my: 3 }} />

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
            Override budget limits for any month.
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1}>
          {savedOverrides.size > 0 && (
            <Chip
              label={`${savedOverrides.size} override${savedOverrides.size > 1 ? 's' : ''}`}
              size="small"
              sx={{ bgcolor: C.hoverStrong, color: 'text.secondary', fontSize: '0.8rem' }}
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
          <FormControl size="small" sx={{ maxWidth: 240 }}>
            <InputLabel>Month</InputLabel>
            <Select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              label="Month"
              {...DROPDOWN_MENU_PROPS}
            >
              {OVERRIDE_MONTH_OPTIONS.map(({ key, label }) => (
                <MenuItem key={key} value={key} sx={DROPDOWN_ITEM_SX}>
                  {label}
                  {key === currentMonth() && (
                    <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.disabled' }}>current</Typography>
                  )}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Override rows for selected month */}
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
                    border: `1px solid ${C.hoverStrong}`,
                    opacity: enabled[t.name] ? 1 : 0.55,
                    '&:hover': { bgcolor: C.subtleBg },
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
                  {savedOverrides.has(t.name) && (
                    <Tooltip title="Remove override for this month">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteType(t.name)}
                        sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, flexShrink: 0 }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              )
            })}
          </Stack>

          {saveError && <Alert severity="error" sx={{ py: 0.5 }}>{saveError}</Alert>}

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {hasExistingOverride ? (
              <Button variant="text" color="error" size="small" onClick={handleReset} disabled={saving}>
                Reset to defaults
              </Button>
            ) : <Box />}
            <Stack direction="row" alignItems="center" gap={2}>
              {saved && (
                <Typography variant="body2" sx={{ color: 'primary.main' }}>Saved!</Typography>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={saving}
                sx={{ fontWeight: 600 }}
              >
                {saving ? 'Saving…' : 'Save Overrides'}
              </Button>
            </Stack>
          </Stack>

          {/* Past months */}
          {otherMonths.length > 0 && (
            <Box>
              <Divider sx={{ borderColor: C.hoverStrong, mb: 2 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1.5 }}>
                Other Months
              </Typography>
              <Stack spacing={0.75}>
                {otherMonths.map(month => {
                  const label = new Date(month + '-02').toLocaleString('en-US', { month: 'long', year: 'numeric' })
                  const isExpanded = expandedPastMonth === month
                  const data = pastMonthData[month]
                  return (
                    <Box key={month}>
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        onClick={() => expandPastMonth(month)}
                        sx={{
                          px: 1.5, py: 0.75, borderRadius: 1.5,
                          border: `1px solid ${C.hoverStrong}`,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: C.subtleBg },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {label}
                        </Typography>
                        <Stack direction="row" alignItems="center" gap={1}>
                          {data && (
                            <Chip
                              label={`${data.length} override${data.length !== 1 ? 's' : ''}`}
                              size="small"
                              sx={{ bgcolor: C.hoverStrong, color: 'text.secondary', fontSize: '0.75rem' }}
                            />
                          )}
                          <IconButton size="small" sx={{ color: 'text.secondary', p: 0.25 }}>
                            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        </Stack>
                      </Stack>
                      <Collapse in={isExpanded}>
                        <Stack spacing={0.5} sx={{ pt: 0.75, pl: 1 }}>
                          {data === undefined && (
                            <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>Loading…</Typography>
                          )}
                          {data?.map(b => {
                            const t = expenseTypes.find(et => et.name === b.type)
                            const IconComp = t ? ICON_REGISTRY[t.icon] : null
                            return (
                              <Stack key={b.type} direction="row" alignItems="center" spacing={1.5}
                                sx={{ px: 1.5, py: 0.4 }}>
                                {t && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />}
                                {IconComp && <IconComp sx={{ fontSize: 16, color: t.color, flexShrink: 0 }} />}
                                <Typography variant="body2" sx={{ color: 'text.primary', flexGrow: 1 }}>
                                  {b.type}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  ${b.monthly_limit.toFixed(0)}
                                  {defaultLimits[b.type] && (
                                    <Box component="span" sx={{ color: 'text.disabled' }}>
                                      {' '}/ default ${parseFloat(defaultLimits[b.type]).toFixed(0)}
                                    </Box>
                                  )}
                                </Typography>
                              </Stack>
                            )
                          })}
                        </Stack>
                      </Collapse>
                    </Box>
                  )
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      </Collapse>
    </Box>
  )
}

// ─── Macrocategory management section ────────────────────────────────────────

function MacrocategoryManager() {
  const C = useC()
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
      <Divider sx={{ borderColor: C.hoverStrong, my: 3 }} />
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
              sx={{ bgcolor: C.hoverStrong, color: 'text.secondary', fontSize: '0.8rem' }} />
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
              sx={{ px: 1.5, py: 1, borderRadius: 1.5, border: `1px solid ${m.color}`, bgcolor: C.subtleBg }}>
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
              sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, border: `1px solid ${C.hoverStrong}`,
                '&:hover': { bgcolor: C.subtleBg } }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', flexGrow: 1 }}>{m.name}</Typography>
              {m.budget_limit > 0 && (
                <Typography variant="body2" color="text.secondary">${m.budget_limit.toFixed(0)} ceiling</Typography>
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
            sx={{ px: 1.5, py: 1, borderRadius: 1.5, border: `1px dashed ${C.borderMed}` }}>
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
  const C = useC()
  const { DROPDOWN_MENU_PROPS, DROPDOWN_ITEM_SX } = useMenuStyles()
  const { expenseTypes, reloadTypes, macrocategories } = useExpenseTypes()
  const [limits, setLimits] = useState({})
  const [currentOverrides, setCurrentOverrides] = useState({})  // typeName → monthly_limit
  const [overrideRefresh, setOverrideRefresh] = useState(0)
  const [loadingBudgets, setLoadingBudgets] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const [defaultsOpen, setDefaultsOpen] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const currentMonthShort = new Date().toLocaleString('en-US', { month: 'short' })

  // Reload budget limits whenever the type list changes (renames, adds, deletes)
  useEffect(() => {
    if (expenseTypes.length === 0) return
    setLoadingBudgets(true)
    setSaved(false)
    api.get('/budgets').then(budgetsRes => {
      const fromApi = Object.fromEntries(
        budgetsRes.data.map(b => [b.type, b.monthly_limit > 0 ? String(b.monthly_limit) : ''])
      )
      const defaults = Object.fromEntries(expenseTypes.map(t => [t.name, '']))
      setLimits({ ...defaults, ...fromApi })
    }).finally(() => setLoadingBudgets(false))
  }, [expenseTypes])

  // Fetch current month overrides to annotate Default Limits rows
  useEffect(() => {
    api.get('/budgets/monthly-overrides', { params: { month: currentMonth() } })
      .then(r => setCurrentOverrides(Object.fromEntries(r.data.map(b => [b.type, b.monthly_limit]))))
      .catch(() => {})
  }, [overrideRefresh, expenseTypes])

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
        borderRadius: 2,
        p: { xs: 3, sm: 4 },
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage spending categories and budget limits.
          </Typography>
        </Box>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<FileUploadIcon />}
            onClick={() => setImportOpen(true)}
            sx={{ fontWeight: 600, flexShrink: 0, color: 'text.secondary', borderColor: C.borderMed }}
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

      <Divider sx={{ borderColor: C.hoverStrong, mt: 2.5 }} />

      {/* Default limits sub-header (collapsible) */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setDefaultsOpen(o => !o)}
        sx={{ cursor: 'pointer', userSelect: 'none', py: 2 }}
      >
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Default Limits
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monthly budget limits applied across all months.
          </Typography>
        </Box>
        <IconButton size="small" sx={{ color: 'text.secondary' }}>
          {defaultsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>

      {/* Category rows */}
      <Collapse in={defaultsOpen}>
      {loadingBudgets ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading…</Typography>
      ) : (
        <form onSubmit={handleSaveBudgets}>
          {(() => {
            function renderRow(t) {
              const IconComp = ICON_REGISTRY[t.icon]
              const hasOverride = currentOverrides[t.name] != null
              const overrideContent = hasOverride ? (
                <>
                  <Box component="span" sx={{ color: 'primary.main' }}>
                    {currentMonthShort} Override: ${Number(currentOverrides[t.name]).toFixed(0)}
                  </Box>
                  {limits[t.name] && ` | Default: $${parseFloat(limits[t.name]).toFixed(0)}`}
                </>
              ) : null
              const inputField = (
                <TextField
                  type="number"
                  placeholder="No limit"
                  value={limits[t.name] ?? ''}
                  onChange={e => handleLimitChange(t.name, e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>$</Typography>,
                  }}
                  inputProps={{ min: '0', step: '0.01', style: { textAlign: 'right', width: 70 } }}
                  sx={{ width: 120, flexShrink: 0 }}
                />
              )
              return (
                <Box
                  key={t.id}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1.5,
                    border: `1px solid ${C.hoverStrong}`,
                    '&:hover': { bgcolor: C.subtleBg },
                  }}
                >
                  {/* Desktop: single row with all elements */}
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ display: { xs: 'none', sm: 'flex' } }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />
                    {IconComp && <IconComp sx={{ fontSize: 18, color: t.color, flexShrink: 0 }} />}
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', flexGrow: 1, minWidth: 0 }}>
                      {t.name}
                    </Typography>
                    {hasOverride && (
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {overrideContent}
                      </Typography>
                    )}
                    {macrocategories.length > 0 && (
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <Select
                          value={t.macrocategory_id ?? ''}
                          onChange={async e => {
                            await api.put(`/expense-types/${t.id}`, {
                              name: t.name, color: t.color, icon: t.icon,
                              macrocategory_id: e.target.value || null,
                            })
                            await reloadTypes()
                          }}
                          displayEmpty
                          sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
                          {...DROPDOWN_MENU_PROPS}
                        >
                          <MenuItem value="" sx={{ ...DROPDOWN_ITEM_SX, fontSize: '0.75rem' }}><em>— No group —</em></MenuItem>
                          {macrocategories.map(m => (
                            <MenuItem key={m.id} value={m.id} sx={{ ...DROPDOWN_ITEM_SX, fontSize: '0.75rem' }}>
                              <Stack direction="row" alignItems="center" gap={1}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
                                {m.name}
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    {inputField}
                    <IconButton size="small" onClick={() => { setEditTarget(t); setFormOpen(true) }}
                      sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, p: 0.5 }}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    {t.name !== 'Other' && (
                      <IconButton size="small" onClick={() => setDeleteTarget(t)}
                        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' }, p: 0.5 }}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>

                  {/* Mobile: row 1 = name + edit/delete, row 2 = input + override */}
                  <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />
                      {IconComp && <IconComp sx={{ fontSize: 18, color: t.color, flexShrink: 0 }} />}
                      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </Typography>
                      <IconButton size="small" onClick={() => { setEditTarget(t); setFormOpen(true) }}
                        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' }, p: 0.5 }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      {t.name !== 'Other' && (
                        <IconButton size="small" onClick={() => setDeleteTarget(t)}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' }, p: 0.5 }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mt: 0.75 }}>
                      {inputField}
                      {hasOverride && (
                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', minWidth: 0 }}>
                          {overrideContent}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Box>
              )
            }

            if (macrocategories.length > 0) {
              const grouped = {}
              macrocategories.forEach(m => { grouped[m.id] = [] })
              const ungrouped = []
              expenseTypes.forEach(t => {
                if (t.macrocategory_id && grouped[t.macrocategory_id]) {
                  grouped[t.macrocategory_id].push(t)
                } else {
                  ungrouped.push(t)
                }
              })
              return (
                <Box mb={2}>
                  {macrocategories.map(m => grouped[m.id].length > 0 && (
                    <Box key={m.id} mb={2}>
                      <Stack direction="row" alignItems="center" gap={1} mb={1}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem' }}>
                          {m.name}
                        </Typography>
                        {m.budget_limit > 0 && (
                          <Typography variant="body2" color="text.secondary">— ${m.budget_limit.toFixed(0)} ceiling</Typography>
                        )}
                      </Stack>
                      <Stack spacing={0.75}>
                        {grouped[m.id].map(renderRow)}
                      </Stack>
                    </Box>
                  ))}
                  {ungrouped.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.75rem', mb: 1 }}>
                        Ungrouped
                      </Typography>
                      <Stack spacing={0.75}>
                        {ungrouped.map(renderRow)}
                      </Stack>
                    </Box>
                  )}
                </Box>
              )
            }

            return (
              <Stack spacing={0.75} mb={3}>
                {expenseTypes.map(renderRow)}
              </Stack>
            )
          })()}

          {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

          <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2} mt={2}>
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
      </Collapse>

      {/* Monthly overrides */}
      <MonthlyOverrides
        expenseTypes={expenseTypes}
        defaultLimits={limits}
        onChanged={() => setOverrideRefresh(s => s + 1)}
      />

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
