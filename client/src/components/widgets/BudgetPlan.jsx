import { useState, useEffect, useRef } from 'react'
import { BarChart2, Loader2, Sparkles } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import api from '../../api.js'
import { useC } from '../../colors'
import { ICON_REGISTRY } from '../../expenseTypes.js'
import AlertBox from '../ui/AlertBox.jsx'
import IconButton from '../ui/IconButton.jsx'
import { currentMonth, addMonths, PLAN_MONTH_OPTIONS } from '../../lib/budgetMonths.js'
import CollapsibleSection from '../ui/CollapsibleSection.jsx'
import DollarInput from '../inputs/DollarInput.jsx'
import AIBudgetRecsDialog from '../dialogs/AIBudgetRecsDialog.jsx'

export default function BudgetPlan({ expenseTypes, defaultLimits, aiEnabled = false, onChanged, onAnalysis }) {
  const C = useC()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [planLimits, setPlanLimits] = useState({})
  const [existingOverrides, setExistingOverrides] = useState(new Set())
  const [catStats, setCatStats] = useState({})
  const [prevGoals, setPrevGoals] = useState({})
  const [avgMonths, setAvgMonths] = useState(3)
  const [excludeOutliers, setExcludeOutliers] = useState(false)
  const [plannedMonths, setPlannedMonths] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState({})
  const [aiLoading, setAiLoading] = useState(false)
  const [reduceOpen, setReduceOpen] = useState(false)
  const aiCache = useRef({})

  useEffect(() => {
    api.get('/budgets/monthly-overrides').then(r => setPlannedMonths(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    setSaved(false)
    const prevMonth = addMonths(selectedMonth, -1)
    Promise.all([
      api.get('/budgets/monthly-overrides', { params: { month: selectedMonth } }),
      api.get('/budgets/effective', { params: { month: prevMonth } }),
    ]).then(([overridesRes, goalsRes]) => {
      const overrides = Object.fromEntries(overridesRes.data.map(b => [b.type, b.monthly_limit]))
      setExistingOverrides(new Set(Object.keys(overrides)))
      const merged = {}
      expenseTypes.forEach(t => {
        merged[t.name] = t.name in overrides ? String(overrides[t.name]) : (defaultLimits[t.name] ?? '')
      })
      setPlanLimits(merged)
      const goalsMap = {}
      goalsRes.data.forEach(b => { goalsMap[b.type] = b.monthly_limit })
      setPrevGoals(goalsMap)
    }).catch(() => {})
  }, [expenseTypes, selectedMonth, defaultLimits])

  useEffect(() => {
    api.get('/incomes/summary', { params: { month: selectedMonth } })
      .then(r => setMonthlyIncome(r.data.total ?? 0))
      .catch(() => setMonthlyIncome(0))
  }, [selectedMonth])

  useEffect(() => {
    api.get('/analysis/category-stats', { params: { months: avgMonths, exclude_outliers: excludeOutliers } })
      .then(r => {
        const map = {}
        r.data.forEach(s => { map[s.type] = { avg: s.avg_monthly, lastSpend: s.last_month } })
        setCatStats(map)
      }).catch(() => {})
  }, [avgMonths, excludeOutliers])

  useEffect(() => {
    if (!aiEnabled) { setAiSuggestions({}); return }
    const cacheKey = `${avgMonths}-${excludeOutliers}`
    if (aiCache.current[cacheKey]) {
      setAiSuggestions(aiCache.current[cacheKey])
      return
    }
    setAiLoading(true)
    api.post('/ai/budget-recommendations', null, { params: { months: avgMonths, exclude_outliers: excludeOutliers } })
      .then(r => {
        const map = {}
        r.data.forEach(rec => { map[rec.type] = rec })
        aiCache.current[cacheKey] = map
        setAiSuggestions(map)
      })
      .catch(() => {})
      .finally(() => setAiLoading(false))
  }, [aiEnabled, avgMonths, excludeOutliers])

  async function handleSave() {
    const budgets = expenseTypes
      .filter(t => planLimits[t.name] !== '' && Number(planLimits[t.name]) >= 0)
      .map(t => ({ type: t.name, monthly_limit: parseFloat(planLimits[t.name]) }))
    if (budgets.length === 0) { setSaveError('Enter at least one budget limit.'); return }
    setSaving(true); setSaveError('')
    try {
      await api.post('/budgets/monthly-overrides', { month: selectedMonth, budgets })
      await Promise.all(
        [...existingOverrides]
          .filter(e => planLimits[e] === '')
          .map(e => api.delete(`/budgets/monthly-overrides/${selectedMonth}/${encodeURIComponent(e)}`))
      )
      setSaved(true)
      setExistingOverrides(new Set(budgets.map(b => b.type)))
      setPlannedMonths(prev => prev.includes(selectedMonth) ? prev : [...prev, selectedMonth])
      onChanged?.()
    } catch { setSaveError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  function handleReduceApply(limitsMap) {
    setPlanLimits(prev => ({ ...prev, ...Object.fromEntries(Object.entries(limitsMap).map(([k, v]) => [k, String(v)])) }))
    setReduceOpen(false)
    setSaved(false)
  }

  const isPillMonth = PLAN_MONTH_OPTIONS.slice(0, 3).some(o => o.key === selectedMonth)
  const selectedLabel = PLAN_MONTH_OPTIONS.find(o => o.key === selectedMonth)?.label ?? ''

  const totalPlanned = expenseTypes.reduce((sum, t) => sum + (Number(planLimits[t.name]) || 0), 0)
  const totalPrevGoal = Object.values(prevGoals).reduce((sum, v) => sum + (Number(v) || 0), 0)
  const totalAvgSpend = Object.values(catStats).reduce((sum, s) => sum + (s?.avg || 0), 0)
  const totalDelta = totalPrevGoal > 0 ? totalPlanned - totalPrevGoal : null
  const net = monthlyIncome - totalPlanned

  const reduceCandidates = expenseTypes
    .map(t => {
      const rec = aiSuggestions[t.name]
      const current = Number(planLimits[t.name])
      if (!rec || !(current > 0)) return null
      if (rec.recommended_limit > current * 0.95 || current - rec.recommended_limit < 5) return null
      return { ...rec, type: t.name, current_limit: current }
    })
    .filter(Boolean)

  const extra = plannedMonths.length > 0 && (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: C.hoverStrong, color: C.muted }}>
      {plannedMonths.length} month{plannedMonths.length !== 1 ? 's' : ''} planned
    </span>
  )

  return (
    <CollapsibleSection
      divider
      title="Plan"
      subtitle="Set budget limits for current and upcoming months."
      extra={extra}
    >
      <div className="flex flex-col gap-4">

        {/* Month selector + controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {PLAN_MONTH_OPTIONS.slice(0, 3).map(({ key, short }) => {
            const isSelected = key === selectedMonth
            const hasplan = plannedMonths.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedMonth(key)}
                className="h-8 px-3 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 border-none cursor-pointer"
                style={{
                  backgroundColor: isSelected ? C.primary : C.hoverStrong,
                  color: isSelected ? 'white' : C.warmText,
                }}
              >
                {hasplan && !isSelected && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.primary, display: 'inline-block', flexShrink: 0 }} />
                )}
                {short}
              </button>
            )
          })}
          <select
            value={isPillMonth ? '' : selectedMonth}
            onChange={e => { if (e.target.value) setSelectedMonth(e.target.value) }}
            className="h-8 rounded-lg border px-3 text-sm bg-transparent"
            style={{
              borderColor: isPillMonth ? C.borderLight : C.primary,
              color: isPillMonth ? C.muted : C.warmText,
              minWidth: 160,
            }}
          >
            <option value="">{isPillMonth ? 'More months…' : selectedLabel}</option>
            {PLAN_MONTH_OPTIONS.slice(3).map(({ key, label }) => (
              <option key={key} value={key}>
                {plannedMonths.includes(key) ? '● ' : ''}{label}
              </option>
            ))}
          </select>
          <select
            value={avgMonths}
            onChange={e => setAvgMonths(Number(e.target.value))}
            className="h-8 rounded-lg border px-3 text-sm bg-transparent"
            style={{ borderColor: C.borderLight, color: C.warmText, minWidth: 110 }}
          >
            {[3, 6, 9, 12].map(n => <option key={n} value={n}>{n}-mo avg</option>)}
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
        </div>

        {/* Total budget summary */}
        <div className="flex items-center gap-5 flex-wrap px-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] leading-none" style={{ color: C.dimText }}>Total planned</span>
            <span className="text-lg font-bold leading-tight" style={{ color: C.warmText }}>${totalPlanned.toFixed(0)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] leading-none" style={{ color: C.dimText }}>Monthly income</span>
            <span className="text-sm font-semibold" style={{ color: C.warmText }}>${monthlyIncome.toFixed(0)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] leading-none" style={{ color: C.dimText }}>Net</span>
            <span className="text-sm font-semibold" style={{ color: net >= 0 ? C.primary : C.overBudget }}>
              {net >= 0 ? '+' : '-'}${Math.abs(net).toFixed(0)}
            </span>
          </div>
          {totalDelta !== null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] leading-none" style={{ color: C.dimText }}>vs last month</span>
              <span className="text-sm font-semibold" style={{ color: totalDelta > 0 ? C.overBudget : totalDelta < 0 ? C.primary : C.muted }}>
                {totalDelta === 0 ? 'Same' : `${totalDelta > 0 ? '+' : '-'}$${Math.abs(totalDelta).toFixed(0)}`}
              </span>
            </div>
          )}
          {totalAvgSpend > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] leading-none" style={{ color: C.dimText }}>{avgMonths}-mo avg spend</span>
              <span className="text-sm font-semibold" style={{ color: C.warmText }}>${totalAvgSpend.toFixed(0)}</span>
            </div>
          )}
          {aiEnabled && reduceCandidates.length > 0 && (
            <Button
              variant="outline" size="sm" onClick={() => setReduceOpen(true)}
              className="font-semibold" style={{ color: C.primary, borderColor: C.primary + '50' }}
            >
              <Sparkles size={14} className="mr-1" />
              Reduce via AI ({reduceCandidates.length})
            </Button>
          )}
        </div>

        {/* Category cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {expenseTypes.map(t => {
            const IconComp = ICON_REGISTRY[t.icon]
            const tColor = C.adaptColor(t.color)
            const stats = catStats[t.name]
            const hasOverride = existingOverrides.has(t.name)
            const rec = aiSuggestions[t.name]
            const statItems = [
              { label: `${avgMonths}-mo avg`, value: stats?.avg != null ? `$${stats.avg.toFixed(0)}` : '—' },
              { label: 'Prev. goal', value: prevGoals[t.name] != null ? `$${Number(prevGoals[t.name]).toFixed(0)}` : '—' },
              { label: 'Prev. spending', value: stats?.lastSpend != null ? `$${stats.lastSpend.toFixed(0)}` : '—' },
            ]
            return (
              <div
                key={t.id}
                className="rounded-xl overflow-hidden flex flex-col"
                style={{ backgroundColor: `${tColor}09`, border: `1px solid ${tColor}28` }}
              >
                {/* Icon + name + planned badge + analysis */}
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
                  {IconComp && <IconComp style={{ fontSize: 16, color: tColor, flexShrink: 0 }} />}
                  <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: C.warmText }}>{t.name}</span>
                  {hasOverride && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${C.primary}22`, color: C.primary }}>planned</span>
                  )}
                  <IconButton title="View analysis" onClick={() => onAnalysis({ name: t.name, color: t.color, icon: t.icon })}>
                    <BarChart2 size={13} />
                  </IconButton>
                </div>
                {/* Budget input */}
                <div className="px-3 pb-2">
                  <DollarInput
                    value={planLimits[t.name] ?? ''}
                    onChange={e => { setPlanLimits(prev => ({ ...prev, [t.name]: e.target.value })); setSaved(false) }}
                    step="1"
                  />
                </div>
                {/* Stats */}
                <div className="flex gap-4 flex-wrap px-3 py-2 mt-auto" style={{ borderTop: `1px solid ${tColor}20` }}>
                  {statItems.map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-[10px] leading-none" style={{ color: C.dimText }}>{label}</span>
                      <span className="text-sm font-semibold" style={{ color: C.warmText }}>{value}</span>
                    </div>
                  ))}
                  {aiEnabled && (
                    aiLoading ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] leading-none" style={{ color: C.primary }}>✨ Tally</span>
                        <Loader2 size={14} className="animate-spin mt-0.5" style={{ color: C.primary }} />
                      </div>
                    ) : rec ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="flex flex-col gap-0.5 cursor-pointer"
                            onClick={() => { setPlanLimits(prev => ({ ...prev, [t.name]: String(rec.recommended_limit.toFixed(0)) })); setSaved(false) }}
                          >
                            <span className="text-[10px] leading-none" style={{ color: C.primary }}>✨ Tally</span>
                            <span className="text-sm font-semibold underline decoration-dotted" style={{ color: C.primary }}>${rec.recommended_limit.toFixed(0)}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-xs leading-snug">
                          {rec.rationale}
                        </TooltipContent>
                      </Tooltip>
                    ) : null
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {saveError && <AlertBox severity="error">{saveError}</AlertBox>}

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm" style={{ color: C.primary }}>Saved!</span>}
          <Button onClick={handleSave} disabled={saving} className="font-semibold">
            {saving ? 'Saving…' : `Save Plan for ${selectedLabel}`}
          </Button>
        </div>

      </div>

      {reduceOpen && (
        <AIBudgetRecsDialog
          recommendations={reduceCandidates}
          onApply={handleReduceApply}
          onClose={() => setReduceOpen(false)}
          title="Reduce Budget"
          subtitle="These categories are regularly under budget — consider lowering their limits."
          baseTotal={totalPlanned}
        />
      )}
    </CollapsibleSection>
  )
}
