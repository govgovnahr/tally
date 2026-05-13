import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '../../api.js'
import { useC } from '../../colors'
import { ICON_REGISTRY } from '../../expenseTypes.js'
import AlertBox from '../ui/AlertBox.jsx'
import { currentMonth, nextMonth, lastMonth, OVERRIDE_MONTH_OPTIONS } from '../../lib/budgetMonths.js'
import CollapsibleSection from '../ui/CollapsibleSection.jsx'
import ColorDot from '../ui/ColorDot.jsx'
import DollarInput from '../inputs/DollarInput.jsx'

export default function MonthlyOverrides({ expenseTypes, defaultLimits, onChanged }) {
  const C = useC()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())

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

  const otherMonths = overrideMonths.filter(m => m !== selectedMonth && m <= currentMonth()).sort((a, b) => b.localeCompare(a))

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

  const extra = savedOverrides.size > 0 && (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: C.hoverStrong, color: C.muted }}>
      {savedOverrides.size} override{savedOverrides.size > 1 ? 's' : ''}
    </span>
  )

  return (
    <CollapsibleSection
      divider
      title="Monthly Overrides"
      subtitle="Override budget limits for any month."
      extra={extra}
    >
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
                <option key={key} value={key}>
                  {overrideMonths.includes(key) ? '● ' : ''}{label}{key === currentMonth() ? ' (current)' : ''}
                </option>
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
                    onMouseEnter={e => e.currentTarget.parentElement.style.backgroundColor = `${tColor}14`}
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
                    <ColorDot color={tColor} />
                    {IconComp && <IconComp style={{ fontSize: 18, color: tColor, flexShrink: 0 }} />}
                    <span className="text-sm font-medium flex-1 min-w-0" style={{ color: C.warmText }}>{t.name}</span>
                    {!enabled[t.name] && defaultLimits[t.name] && !isNextMonth && (
                      <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>default ${parseFloat(defaultLimits[t.name]).toFixed(0)}</span>
                    )}
                    <DollarInput
                      value={overrideLimits[t.name] ?? ''}
                      onChange={e => { setOverrideLimits(prev => ({ ...prev, [t.name]: e.target.value })); setSaved(false) }}
                      disabled={!enabled[t.name]}
                      className="flex-shrink-0 w-32"
                      inputClassName="h-8"
                    />
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
                                {et && <ColorDot color={etColor} />}
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
    </CollapsibleSection>
  )
}
