import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2, Upload } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '../api.js'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { ICON_REGISTRY, ICON_OPTIONS } from '../expenseTypes.js'
import ImportBudgetsDialog from './ImportBudgetsDialog.jsx'
import { useC, TYPE_PALETTE } from '../colors'
import { Card } from 'glasscn-ui'

const PRESET_COLORS = TYPE_PALETTE

// ─── Shared ───────────────────────────────────────────────────────────────────

function AlertBox({ severity, children }) {
  const C = useC()
  const colors = {
    error:   { bg: `${C.overBudget}15`, border: `${C.overBudget}40`, text: C.overBudget },
    warning: { bg: `${C.atRisk}15`, border: `${C.atRisk}40`, text: C.atRisk },
    success: { bg: `${C.onTrack}15`, border: `${C.onTrack}40`, text: C.onTrack },
  }
  const s = colors[severity] ?? colors.error
  return (
    <div className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {children}
    </div>
  )
}

function ColorSwatch({ color, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-full transition-opacity hover:opacity-85"
      style={{
        width: 26, height: 26, backgroundColor: color, flexShrink: 0,
        border: selected ? '3px solid white' : '3px solid transparent',
        outline: selected ? `2px solid ${color}` : 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

// ─── Category form dialog ─────────────────────────────────────────────────────

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
      if (isEditing) await api.put(`/expense-types/${existing.id}`, { name: name.trim(), color, icon })
      else await api.post('/expense-types', { name: name.trim(), color, icon })
      onSaved(); onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save category.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input autoFocus value={name} onChange={e => { setName(e.target.value); setError('') }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: C.muted }}>Icon</p>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ key, Icon, label }) => (
                <div
                  key={key}
                  title={label}
                  onClick={() => setIcon(key)}
                  className="flex items-center justify-center cursor-pointer rounded-lg transition-colors duration-150"
                  style={{
                    width: 38, height: 38,
                    border: icon === key ? `2px solid ${color}` : `2px solid ${C.border}`,
                    backgroundColor: icon === key ? C.hoverMed : 'transparent',
                  }}
                >
                  <Icon style={{ fontSize: 19, color: icon === key ? color : C.muted }} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs" style={{ color: C.muted }}>Color</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <ColorSwatch key={c} color={c} selected={color === c} onClick={() => setColor(c)} />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color, border: `1px solid ${C.borderMed}` }} />
              <Input
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="#rrggbb"
                maxLength={7}
                className="w-28 text-sm"
              />
            </div>
          </div>
          {error && <AlertBox severity="error">{error}</AlertBox>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({ open, onClose, onDeleted, type, otherTypes }) {
  const C = useC()
  const [reassignTo, setReassignTo] = useState('')
  const [error, setError] = useState('')
  const [needsReassign, setNeedsReassign] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      const params = reassignTo ? { reassign_to: reassignTo } : {}
      await api.delete(`/expense-types/${type.id}`, { params })
      onDeleted(); onClose()
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      if (err.response?.status === 409) { setNeedsReassign(true); setError(detail) }
      else setError(detail || 'Failed to delete category.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete "{type?.name}"?</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3 pt-1">
          {!needsReassign && (
            <p className="text-sm" style={{ color: C.muted }}>
              This will permanently delete the category and remove its budget goal.
            </p>
          )}
          {needsReassign && (
            <>
              <AlertBox severity="warning">{error}</AlertBox>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Reassign expenses to</label>
                <select
                  value={reassignTo}
                  onChange={e => setReassignTo(e.target.value)}
                  className="h-9 w-full rounded-lg border px-3 text-sm bg-transparent"
                  style={{ borderColor: C.borderLight, color: C.warmText }}
                >
                  <option value="">Select a category</option>
                  {otherTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </>
          )}
          {error && !needsReassign && <AlertBox severity="error">{error}</AlertBox>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading || (needsReassign && !reassignTo)}>
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Monthly Overrides ────────────────────────────────────────────────────────

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth() {
  const now = new Date()
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const m = now.getMonth() === 11 ? 1 : now.getMonth() + 2
  return `${y}-${String(m).padStart(2, '0')}`
}

function lastMonth() {
  const now = new Date()
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const m = now.getMonth() === 0 ? 12 : now.getMonth()
  return `${y}-${String(m).padStart(2, '0')}`
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
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState({})
  const [overrideLimits, setOverrideLimits] = useState({})
  const [savedOverrides, setSavedOverrides] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [catStats, setCatStats] = useState({})
  const [prevGoals, setPrevGoals] = useState({})
  const [avgMonths, setAvgMonths] = useState(3)
  const [excludeOutliers, setExcludeOutliers] = useState(false)
  const [overrideMonths, setOverrideMonths] = useState([])
  const [expandedPastMonth, setExpandedPastMonth] = useState(null)
  const [pastMonthData, setPastMonthData] = useState({})

  useEffect(() => {
    setSaved(false)
    api.get('/budgets/monthly-overrides', { params: { month: selectedMonth } }).then(r => {
      const existing = Object.fromEntries(r.data.map(b => [b.type, b.monthly_limit]))
      const newEnabled = {}; const newLimits = {}
      expenseTypes.forEach(t => {
        newEnabled[t.name] = t.name in existing
        newLimits[t.name] = t.name in existing ? String(existing[t.name]) : (defaultLimits[t.name] ?? '')
      })
      setEnabled(newEnabled); setOverrideLimits(newLimits)
      setSavedOverrides(new Set(Object.keys(existing)))
    }).catch(() => {})
  }, [expenseTypes, selectedMonth])

  useEffect(() => {
    api.get('/budgets/monthly-overrides').then(r => setOverrideMonths(r.data)).catch(() => {})
  }, [saved])

  const isNextMonth = selectedMonth === nextMonth()

  useEffect(() => {
    if (!isNextMonth) return
    Promise.all([
      api.get('/analysis/category-stats', { params: { months: avgMonths, exclude_outliers: excludeOutliers } }),
      api.get('/budgets/effective', { params: { month: lastMonth() } }),
    ]).then(([statsRes, goalsRes]) => {
      const statsMap = {}
      statsRes.data.forEach(s => { statsMap[s.type] = { avg_monthly: s.avg_monthly, last_month: s.last_month } })
      setCatStats(statsMap)
      const goalsMap = {}
      goalsRes.data.forEach(b => { goalsMap[b.type] = b.monthly_limit })
      setPrevGoals(goalsMap)
    }).catch(() => {})
  }, [isNextMonth, avgMonths, excludeOutliers])

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
    setSaving(true); setSaveError('')
    try {
      await api.post('/budgets/monthly-overrides', { month: selectedMonth, budgets })
      setSaved(true); setSavedOverrides(new Set(budgets.map(b => b.type))); onChanged?.()
    } catch { setSaveError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  async function handleDeleteType(typeName) {
    try {
      await api.delete(`/budgets/monthly-overrides/${selectedMonth}/${encodeURIComponent(typeName)}`)
      setSavedOverrides(prev => { const next = new Set(prev); next.delete(typeName); return next })
      setEnabled(prev => ({ ...prev, [typeName]: false }))
      setOverrideLimits(prev => ({ ...prev, [typeName]: defaultLimits[typeName] ?? '' }))
      onChanged?.()
    } catch { setSaveError('Failed to delete override.') }
  }

  async function handleReset() {
    setSaving(true); setSaveError('')
    try {
      await api.delete(`/budgets/monthly-overrides/${selectedMonth}`)
      setEnabled(Object.fromEntries(expenseTypes.map(t => [t.name, false])))
      setOverrideLimits(Object.fromEntries(expenseTypes.map(t => [t.name, defaultLimits[t.name] ?? ''])))
      setSavedOverrides(new Set()); onChanged?.()
    } catch { setSaveError('Failed to reset.') }
    finally { setSaving(false) }
  }

  const hasExistingOverride = savedOverrides.size > 0

  return (
    <div>
      <div className="h-px my-5" style={{ backgroundColor: C.hoverStrong }} />
      <div className="flex items-center justify-between cursor-pointer select-none"
        style={{ marginBottom: open ? 16 : 0 }}
        onClick={() => setOpen(o => !o)}>
        <div>
          <p className="text-sm font-semibold" style={{ color: C.warmText }}>Monthly Overrides</p>
          <p className="text-sm" style={{ color: C.muted }}>Override budget limits for any month.</p>
        </div>
        <div className="flex items-center gap-2">
          {savedOverrides.size > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: C.hoverStrong, color: C.muted }}>
              {savedOverrides.size} override{savedOverrides.size > 1 ? 's' : ''}
            </span>
          )}
          <button type="button" className="p-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: C.muted }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? '9999px' : '0px' }}>
        <div className="flex flex-col gap-4">
          {/* Month + options */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="h-9 rounded-lg border px-3 text-sm bg-transparent"
              style={{ borderColor: C.borderLight, color: C.warmText, minWidth: 200 }}
            >
              {OVERRIDE_MONTH_OPTIONS.map(({ key, label }) => (
                <option key={key} value={key}>{label}{key === currentMonth() ? ' (current)' : ''}</option>
              ))}
            </select>
            {isNextMonth && (
              <>
                <select
                  value={avgMonths}
                  onChange={e => setAvgMonths(Number(e.target.value))}
                  className="h-9 rounded-lg border px-3 text-sm bg-transparent"
                  style={{ borderColor: C.borderLight, color: C.warmText, minWidth: 140 }}
                >
                  {[3, 6, 9, 12].map(n => <option key={n} value={n}>{n} months</option>)}
                </select>
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm" style={{ color: C.muted }}>
                  <div
                    onClick={() => setExcludeOutliers(v => !v)}
                    className="relative w-9 h-5 rounded-full cursor-pointer transition-colors duration-200 flex-shrink-0"
                    style={{ backgroundColor: excludeOutliers ? C.primary : C.hoverStrong }}
                  >
                    <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ left: excludeOutliers ? '18px' : '2px' }} />
                  </div>
                  Exclude outliers
                </label>
              </>
            )}
          </div>

          {/* Override rows */}
          <div className="flex flex-col gap-1.5">
            {expenseTypes.map(t => {
              const IconComp = ICON_REGISTRY[t.icon]
              const stats = isNextMonth ? catStats[t.name] : null
              const tColor = C.adaptColor(t.color)
              return (
                <div
                  key={t.id}
                  className="rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${C.hoverStrong}`, opacity: enabled[t.name] ? 1 : 0.55 }}
                >
                  <div className="flex items-center gap-3 px-3 py-2"
                    onMouseEnter={e => e.currentTarget.parentElement.style.backgroundColor = C.subtleBg}
                    onMouseLeave={e => e.currentTarget.parentElement.style.backgroundColor = 'transparent'}>
                    <div
                      onClick={() => { setEnabled(prev => ({ ...prev, [t.name]: !prev[t.name] })); setSaved(false) }}
                      className="w-4 h-4 rounded border cursor-pointer flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: enabled[t.name] ? C.primary : C.borderMed,
                        backgroundColor: enabled[t.name] ? C.primary : 'transparent',
                      }}
                    >
                      {enabled[t.name] && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tColor }} />
                    {IconComp && <IconComp style={{ fontSize: 18, color: tColor, flexShrink: 0 }} />}
                    <span className="text-sm font-medium flex-1 min-w-0" style={{ color: C.warmText }}>{t.name}</span>
                    {!enabled[t.name] && defaultLimits[t.name] && !isNextMonth && (
                      <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>default ${parseFloat(defaultLimits[t.name]).toFixed(0)}</span>
                    )}
                    <div className="relative flex-shrink-0 w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>$</span>
                      <Input
                        type="number"
                        placeholder="No limit"
                        value={overrideLimits[t.name] ?? ''}
                        onChange={e => { setOverrideLimits(prev => ({ ...prev, [t.name]: e.target.value })); setSaved(false) }}
                        disabled={!enabled[t.name]}
                        className="pl-7 text-right h-8 text-sm"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {savedOverrides.has(t.name) && (
                      <button type="button" title="Remove override for this month"
                        onClick={() => handleDeleteType(t.name)}
                        className="p-1 rounded-lg bg-transparent border-none cursor-pointer flex-shrink-0 transition-colors duration-150"
                        style={{ color: C.dimText }}
                        onMouseEnter={e => e.currentTarget.style.color = C.overBudget}
                        onMouseLeave={e => e.currentTarget.style.color = C.dimText}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {isNextMonth && (
                    <div className="flex gap-6 px-4 py-2" style={{ borderTop: `1px solid ${C.hoverStrong}` }}>
                      {[
                        { label: `${avgMonths}-mo avg`, value: stats?.avg_monthly != null ? `$${stats.avg_monthly.toFixed(0)}` : '—' },
                        { label: 'Prev. goal', value: prevGoals[t.name] != null ? `$${parseFloat(prevGoals[t.name]).toFixed(0)}` : '—' },
                        { label: 'Prev. spending', value: stats?.last_month != null ? `$${stats.last_month.toFixed(0)}` : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col gap-0.5">
                          <span className="text-[10px] leading-none" style={{ color: C.dimText }}>{label}</span>
                          <span className="text-sm font-semibold" style={{ color: C.warmText }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {saveError && <AlertBox severity="error">{saveError}</AlertBox>}

          <div className="flex items-center justify-between">
            {hasExistingOverride ? (
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}
                className="text-red-500 hover:text-red-600">
                Reset to defaults
              </Button>
            ) : <div />}
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm" style={{ color: C.primary }}>Saved!</span>}
              <Button onClick={handleSave} disabled={saving} className="font-semibold">
                {saving ? 'Saving…' : 'Save Overrides'}
              </Button>
            </div>
          </div>

          {/* Past months */}
          {otherMonths.length > 0 && (
            <div>
              <div className="h-px mb-4" style={{ backgroundColor: C.hoverStrong }} />
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.muted }}>Other Months</p>
              <div className="flex flex-col gap-2">
                {otherMonths.map(month => {
                  const label = new Date(month + '-02').toLocaleString('en-US', { month: 'long', year: 'numeric' })
                  const isExpanded = expandedPastMonth === month
                  const data = pastMonthData[month]
                  return (
                    <div key={month}>
                      <div
                        className="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors duration-150"
                        style={{ border: `1px solid ${C.hoverStrong}` }}
                        onClick={() => expandPastMonth(month)}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = C.subtleBg}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span className="text-sm font-medium" style={{ color: C.warmText }}>{label}</span>
                        <div className="flex items-center gap-2">
                          {data && (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: C.hoverStrong, color: C.muted }}>
                              {data.length} override{data.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          <span style={{ color: C.muted }}>{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                        </div>
                      </div>
                      <div className="overflow-hidden transition-all duration-200"
                        style={{ maxHeight: isExpanded ? '9999px' : '0px' }}>
                        <div className="flex flex-col gap-1 pt-1.5 pl-3">
                          {data === undefined && <span className="text-xs px-3" style={{ color: C.muted }}>Loading…</span>}
                          {data?.map(b => {
                            const et = expenseTypes.find(x => x.name === b.type)
                            const IconComp = et ? ICON_REGISTRY[et.icon] : null
                            const etColor = et ? C.adaptColor(et.color) : C.dimText
                            return (
                              <div key={b.type} className="flex items-center gap-3 px-3 py-1">
                                {et && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: etColor }} />}
                                {IconComp && <IconComp style={{ fontSize: 15, color: etColor, flexShrink: 0 }} />}
                                <span className="text-sm flex-1" style={{ color: C.warmText }}>{b.type}</span>
                                <span className="text-sm" style={{ color: C.muted }}>
                                  ${b.monthly_limit.toFixed(0)}
                                  {defaultLimits[b.type] && (
                                    <span style={{ color: C.dimText }}> / default ${parseFloat(defaultLimits[b.type]).toFixed(0)}</span>
                                  )}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Macrocategory Manager ────────────────────────────────────────────────────

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
      setNewName(''); setNewBudget(''); setError(''); reloadMacros()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to save.') }
  }

  async function handleSaveEdit() {
    const name = editName.trim()
    if (!name) return setError('Name is required.')
    try {
      await api.put(`/macrocategories/${editTarget.id}`, { name, color: editColor, budget_limit: editBudget ? parseFloat(editBudget) : null })
      setEditTarget(null); setError(''); reloadMacros()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to save.') }
  }

  async function handleDelete(id) {
    try { await api.delete(`/macrocategories/${id}`); reloadMacros() } catch { /* ignore */ }
  }

  return (
    <div>
      <div className="h-px my-5" style={{ backgroundColor: C.hoverStrong }} />
      <div className="flex items-center justify-between cursor-pointer select-none"
        style={{ marginBottom: open ? 16 : 0 }}
        onClick={() => setOpen(o => !o)}>
        <div>
          <p className="text-sm font-semibold" style={{ color: C.warmText }}>Macrocategories</p>
          <p className="text-sm" style={{ color: C.muted }}>Group categories into larger buckets.</p>
        </div>
        <div className="flex items-center gap-2">
          {macrocategories.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: C.hoverStrong, color: C.muted }}>
              {macrocategories.length}
            </span>
          )}
          <button type="button" className="p-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: C.muted }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? '9999px' : '0px' }}>
        <div className="flex flex-col gap-2">
          {macrocategories.map(m => editTarget?.id === m.id ? (
            <div key={m.id} className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-xl"
              style={{ border: `1px solid ${m.color}`, backgroundColor: C.subtleBg }}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: editColor }} />
              <Input value={editName} onChange={e => setEditName(e.target.value)} autoFocus className="flex-1 h-8 text-sm" />
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>$</span>
                <Input value={editBudget} onChange={e => setEditBudget(e.target.value)}
                  placeholder="No ceiling" type="number" min="0" className="pl-7 h-8 text-sm w-28" />
              </div>
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {PRESET_COLORS.map(c => <ColorSwatch key={c} color={c} selected={editColor === c} onClick={() => setEditColor(c)} />)}
              </div>
              <Button size="sm" onClick={handleSaveEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditTarget(null); setError('') }}>Cancel</Button>
            </div>
          ) : (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors duration-150"
              style={{ border: `1px solid ${C.hoverStrong}` }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = C.subtleBg}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
              <span className="text-sm font-medium flex-1" style={{ color: C.warmText }}>{m.name}</span>
              {m.budget_limit > 0 && (
                <span className="text-sm" style={{ color: C.muted }}>${m.budget_limit.toFixed(0)} ceiling</span>
              )}
              <button type="button" onClick={() => { setEditTarget(m); setEditName(m.name); setEditColor(m.color); setEditBudget(m.budget_limit ? String(m.budget_limit) : ''); setError('') }}
                className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150"
                style={{ color: C.muted }}
                onMouseEnter={e => e.currentTarget.style.color = C.primary}
                onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                <Pencil size={14} />
              </button>
              <button type="button" onClick={() => handleDelete(m.id)}
                className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150"
                style={{ color: C.muted }}
                onMouseEnter={e => e.currentTarget.style.color = C.overBudget}
                onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {/* Add new */}
          <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-xl"
            style={{ border: `1px dashed ${C.borderMed}` }}>
            <Input placeholder="Group name" value={newName}
              onChange={e => { setNewName(e.target.value); setError('') }}
              className="flex-1 h-8 text-sm min-w-[120px]" />
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>$</span>
              <Input value={newBudget} onChange={e => setNewBudget(e.target.value)}
                placeholder="No ceiling" type="number" min="0" className="pl-7 h-8 text-sm w-28" />
            </div>
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {PRESET_COLORS.map(c => <ColorSwatch key={c} color={c} selected={newColor === c} onClick={() => setNewColor(c)} />)}
            </div>
            <Button size="sm" variant="outline" onClick={handleAdd}>
              <Plus size={14} className="mr-1" />Add
            </Button>
          </div>

          {error && <AlertBox severity="error">{error}</AlertBox>}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BudgetGoals({ onSaved }) {
  const C = useC()
  const { expenseTypes, reloadTypes, macrocategories } = useExpenseTypes()
  const [limits, setLimits] = useState({})
  const [currentOverrides, setCurrentOverrides] = useState({})
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

  useEffect(() => {
    if (expenseTypes.length === 0) return
    setLoadingBudgets(true); setSaved(false)
    api.get('/budgets').then(budgetsRes => {
      const fromApi = Object.fromEntries(budgetsRes.data.map(b => [b.type, b.monthly_limit > 0 ? String(b.monthly_limit) : '']))
      const defaults = Object.fromEntries(expenseTypes.map(t => [t.name, '']))
      setLimits({ ...defaults, ...fromApi })
    }).finally(() => setLoadingBudgets(false))
  }, [expenseTypes])

  useEffect(() => {
    api.get('/budgets/monthly-overrides', { params: { month: currentMonth() } })
      .then(r => setCurrentOverrides(Object.fromEntries(r.data.map(b => [b.type, b.monthly_limit]))))
      .catch(() => {})
  }, [overrideRefresh, expenseTypes])

  function handleLimitChange(typeName, value) {
    setLimits(prev => ({ ...prev, [typeName]: value })); setSaved(false); setSaveError('')
  }

  async function handleSaveBudgets(e) {
    e.preventDefault()
    const budgets = expenseTypes
      .filter(t => limits[t.name] !== '' && Number(limits[t.name]) >= 0)
      .map(t => ({ type: t.name, monthly_limit: parseFloat(limits[t.name]) }))
    if (budgets.length === 0) return setSaveError('Enter at least one budget limit.')
    setSaving(true)
    try { await api.post('/budgets', budgets); setSaved(true); onSaved() }
    catch { setSaveError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  async function handleTypeSaved() { await reloadTypes(); onSaved() }
  async function handleTypeDeleted() { await reloadTypes(); onSaved() }

  function renderRow(t) {
    const IconComp = ICON_REGISTRY[t.icon]
    const tColor = C.adaptColor(t.color)
    const hasOverride = currentOverrides[t.name] != null
    const inputField = (
      <div className="relative flex-shrink-0 w-32">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>$</span>
        <Input
          type="number"
          placeholder="No limit"
          value={limits[t.name] ?? ''}
          onChange={e => handleLimitChange(t.name, e.target.value)}
          className="pl-7 text-right h-8 text-sm"
          min="0"
          step="0.01"
        />
      </div>
    )
    const overrideLabel = hasOverride ? (
      <span className="text-xs flex-shrink-0 whitespace-nowrap" style={{ color: C.muted }}>
        <span style={{ color: C.primary }}>{currentMonthShort} Override: ${Number(currentOverrides[t.name]).toFixed(0)}</span>
        {limits[t.name] && ` | Default: $${parseFloat(limits[t.name]).toFixed(0)}`}
      </span>
    ) : null

    return (
      <div
        key={t.id}
        className="rounded-xl px-3 py-2 transition-colors duration-150"
        style={{ border: `1px solid ${C.hoverStrong}` }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = C.subtleBg}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        {/* Desktop */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tColor }} />
          {IconComp && <IconComp style={{ fontSize: 18, color: tColor, flexShrink: 0 }} />}
          <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: C.warmText }}>{t.name}</span>
          {overrideLabel}
          {macrocategories.length > 0 && (
            <select
              value={t.macrocategory_id ?? ''}
              onChange={async e => {
                await api.put(`/expense-types/${t.id}`, { name: t.name, color: t.color, icon: t.icon, macrocategory_id: e.target.value || null })
                await reloadTypes()
              }}
              className="h-8 rounded-lg border px-2 text-xs bg-transparent flex-shrink-0"
              style={{ borderColor: C.borderLight, color: C.muted, minWidth: 120 }}
            >
              <option value="">— No group —</option>
              {macrocategories.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
          {inputField}
          <button type="button" title="Edit category" onClick={() => { setEditTarget(t); setFormOpen(true) }}
            className="p-1 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150"
            style={{ color: C.muted }}
            onMouseEnter={e => e.currentTarget.style.color = C.primary}
            onMouseLeave={e => e.currentTarget.style.color = C.muted}>
            <Pencil size={14} />
          </button>
          {t.name !== 'Other' && (
            <button type="button" title="Delete category" onClick={() => setDeleteTarget(t)}
              className="p-1 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150"
              style={{ color: C.muted }}
              onMouseEnter={e => e.currentTarget.style.color = C.overBudget}
              onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
        {/* Mobile */}
        <div className="sm:hidden">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tColor }} />
            {IconComp && <IconComp style={{ fontSize: 18, color: tColor, flexShrink: 0 }} />}
            <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: C.warmText }}>{t.name}</span>
            <button type="button" onClick={() => { setEditTarget(t); setFormOpen(true) }}
              className="p-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: C.muted }}>
              <Pencil size={14} />
            </button>
            {t.name !== 'Other' && (
              <button type="button" onClick={() => setDeleteTarget(t)}
                className="p-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: C.muted }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            {inputField}
            {overrideLabel}
          </div>
        </div>
      </div>
    )
  }

  function renderGrouped() {
    if (macrocategories.length === 0) return (
      <div className="flex flex-col gap-1.5 mb-4">{expenseTypes.map(renderRow)}</div>
    )
    const grouped = {}
    macrocategories.forEach(m => { grouped[m.id] = [] })
    const ungrouped = []
    expenseTypes.forEach(t => {
      if (t.macrocategory_id && grouped[t.macrocategory_id]) grouped[t.macrocategory_id].push(t)
      else ungrouped.push(t)
    })
    return (
      <div className="mb-4">
        {macrocategories.map(m => grouped[m.id].length > 0 && (
          <div key={m.id} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>{m.name}</span>
              {m.budget_limit > 0 && <span className="text-xs" style={{ color: C.muted }}>— ${m.budget_limit.toFixed(0)} ceiling</span>}
            </div>
            <div className="flex flex-col gap-1.5">{grouped[m.id].map(renderRow)}</div>
          </div>
        ))}
        {ungrouped.length > 0 && (
          <div className="mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: C.muted }}>Ungrouped</span>
            <div className="flex flex-col gap-1.5">{ungrouped.map(renderRow)}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card variant="glass" blur="xl" className="rounded-xl p-5 sm:p-7">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-base font-semibold mb-0.5" style={{ color: C.warmText }}>Settings</h2>
          <p className="text-sm" style={{ color: C.muted }}>Manage spending categories and budget limits.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="font-semibold" style={{ color: C.muted, borderColor: C.borderMed }}>
            <Upload size={14} className="mr-1" />Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditTarget(null); setFormOpen(true) }} className="font-semibold">
            <Plus size={14} className="mr-1" />Add Category
          </Button>
        </div>
      </div>

      <div className="h-px mt-4" style={{ backgroundColor: C.hoverStrong }} />

      {/* Default limits */}
      <div
        className="flex items-center justify-between cursor-pointer select-none py-4"
        onClick={() => setDefaultsOpen(o => !o)}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: C.warmText }}>Default Limits</p>
          <p className="text-sm" style={{ color: C.muted }}>Monthly budget limits applied across all months.</p>
        </div>
        <button type="button" className="p-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: C.muted }}>
          {defaultsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: defaultsOpen ? '9999px' : '0px' }}>
        {loadingBudgets ? (
          <p className="text-sm py-4" style={{ color: C.muted }}>Loading…</p>
        ) : (
          <form onSubmit={handleSaveBudgets}>
            {renderGrouped()}
            {saveError && <AlertBox severity="error">{saveError}</AlertBox>}
            <div className="flex items-center justify-end gap-4 mt-3">
              {saved && <span className="text-sm" style={{ color: C.primary }}>Changes saved!</span>}
              <Button type="submit" disabled={saving} className="font-semibold">
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </div>

      <MonthlyOverrides expenseTypes={expenseTypes} defaultLimits={limits} onChanged={() => setOverrideRefresh(s => s + 1)} />
      <MacrocategoryManager />

      {importOpen && (
        <ImportBudgetsDialog
          onClose={() => setImportOpen(false)}
          onImported={async () => { setImportOpen(false); await reloadTypes(); onSaved() }}
        />
      )}
      {formOpen && (
        <CategoryFormDialog open onClose={() => setFormOpen(false)} onSaved={handleTypeSaved} existing={editTarget} />
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
    </Card>
  )
}
