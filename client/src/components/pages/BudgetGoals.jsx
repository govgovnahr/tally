import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Upload, BarChart2, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from 'glasscn-ui'
import api from '../../api.js'
import { useExpenseTypes } from '../../ExpenseTypesContext.jsx'
import { ICON_REGISTRY } from '../../expenseTypes.js'
import { useC } from '../../colors'
import { useTutorial } from '../../TutorialContext.jsx'
import { currentMonth } from '../../lib/budgetMonths.js'
import AlertBox from '../ui/AlertBox.jsx'
import AIBudgetRecsDialog from '../dialogs/AIBudgetRecsDialog.jsx'
import { qk } from '../../queryKeys.js'
import IconButton from '../ui/IconButton.jsx'
import CategoryAnalysisDialog from '../dialogs/CategoryAnalysisDialog.jsx'
import ImportBudgetsDialog from '../dialogs/ImportBudgetsDialog.jsx'
import CategoryFormDialog from '../dialogs/CategoryFormDialog.jsx'
import DeleteDialog from '../dialogs/DeleteDialog.jsx'
import MonthlyOverrides from '../widgets/MonthlyOverrides.jsx'
import BudgetPlan from '../widgets/BudgetPlan.jsx'
import MacrocategoryManager from '../widgets/MacrocategoryManager.jsx'
import CollapsibleSection from '../ui/CollapsibleSection.jsx'
import DollarInput from '../inputs/DollarInput.jsx'
import ColorDot from '../ui/ColorDot.jsx'

export default function BudgetGoals() {
  const C = useC()
  const { suggestAdvancedTour, suggestOnboardingTour } = useTutorial()
  const queryClient = useQueryClient()

  useEffect(() => { suggestOnboardingTour?.() }, [])
  const { data: settings } = useQuery({ queryKey: qk.settings(), queryFn: () => api.get('/settings').then(r => r.data) })
  const aiEnabled = settings?.ai_enabled ?? false

  const { expenseTypes, reloadTypes, macrocategories } = useExpenseTypes()
  const [limits, setLimits] = useState({})
  const [currentOverrides, setCurrentOverrides] = useState({})
  const [loadingBudgets, setLoadingBudgets] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [analysisCategory, setAnalysisCategory] = useState(null)
  const [aiRecsOpen, setAiRecsOpen] = useState(false)
  const [aiRecs, setAiRecs] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

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
  }, [expenseTypes])

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
    try {
      await api.post('/budgets', budgets)
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      queryClient.invalidateQueries({ queryKey: ['analysis'] })
    }
    catch { setSaveError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  async function handleAISuggest() {
    setAiLoading(true); setAiError('')
    try {
      const res = await api.post('/ai/budget-recommendations')
      setAiRecs(res.data)
      setAiRecsOpen(true)
    } catch (e) {
      setAiError(e.response?.data?.detail || 'AI suggestions unavailable. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  function handleAiApply(limitsMap) {
    setLimits(prev => ({ ...prev, ...Object.fromEntries(Object.entries(limitsMap).map(([k, v]) => [k, String(v)])) }))
    setAiRecsOpen(false)
    setSaved(false)
  }

  async function handleTypeSaved() {
    await reloadTypes()
    queryClient.invalidateQueries({ queryKey: ['budgets'] })
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['analysis'] })
  }
  async function handleTypeDeleted() {
    await reloadTypes()
    queryClient.invalidateQueries({ queryKey: ['budgets'] })
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['analysis'] })
  }

  function renderRow(t) {
    const IconComp = ICON_REGISTRY[t.icon]
    const tColor = C.adaptColor(t.color)
    const hasOverride = currentOverrides[t.name] != null

    return (
      <div
        key={t.id}
        className="rounded-xl flex flex-col"
        style={{ backgroundColor: `${tColor}09`, border: `1px solid ${tColor}28` }}
      >
        {/* Header: icon + name + actions */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          {IconComp && <IconComp style={{ fontSize: 16, color: tColor, flexShrink: 0 }} />}
          <span className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: C.warmText }}>{t.name}</span>
          <div className="flex items-center gap-0 flex-shrink-0">
            <IconButton title="View analysis" onClick={() => setAnalysisCategory({ name: t.name, color: t.color, icon: t.icon })}>
              <BarChart2 size={13} />
            </IconButton>
            <IconButton title="Edit category" onClick={() => { setEditTarget(t); setFormOpen(true) }}>
              <Pencil size={13} />
            </IconButton>
            {t.name !== 'Other' && (
              <IconButton title="Delete category" onClick={() => setDeleteTarget(t)} hoverColor={C.overBudget}>
                <Trash2 size={13} />
              </IconButton>
            )}
          </div>
        </div>

        {/* Macrocategory selector */}
        {macrocategories.length > 0 && (
          <div className="px-3 pb-1.5">
            <select
              value={t.macrocategory_id ?? ''}
              onChange={async e => {
                await api.put(`/expense-types/${t.id}`, { name: t.name, color: t.color, icon: t.icon, macrocategory_id: e.target.value || null })
                await reloadTypes()
              }}
              className="w-full h-7 rounded-lg border px-2 text-xs bg-transparent"
              style={{ borderColor: C.borderLight, color: C.muted }}
            >
              <option value="">— No group —</option>
              {macrocategories.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        {/* Current month override badge */}
        {hasOverride && (
          <div className="px-3 pb-1">
            <span className="text-[10px]" style={{ color: C.primary }}>
              {currentMonthShort}: ${Number(currentOverrides[t.name]).toFixed(0)}
              {limits[t.name] && <span style={{ color: C.dimText }}> / default ${parseFloat(limits[t.name]).toFixed(0)}</span>}
            </span>
          </div>
        )}

        {/* Budget input */}
        <div className="px-3 pb-2.5">
          <DollarInput
            value={limits[t.name] ?? ''}
            onChange={e => handleLimitChange(t.name, e.target.value)}
          />
        </div>
      </div>
    )
  }

  function renderGrouped() {
    if (macrocategories.length === 0) return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">{expenseTypes.map(renderRow)}</div>
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
              <ColorDot color={m.color} size="md" />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.muted }}>{m.name}</span>
              {m.budget_limit > 0 && <span className="text-xs" style={{ color: C.muted }}>— ${m.budget_limit.toFixed(0)} ceiling</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{grouped[m.id].map(renderRow)}</div>
          </div>
        ))}
        {ungrouped.length > 0 && (
          <div className="mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: C.muted }}>Ungrouped</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{ungrouped.map(renderRow)}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="rounded-xl p-5 sm:p-7 pb-0 sm:pb-0" data-tour="budget-list">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-base font-semibold mb-0.5" style={{ color: C.warmText }}>Budget Planning</h2>
          <p className="text-sm" style={{ color: C.muted }}>Manage spending categories and budget limits.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {aiEnabled && (
            <Button variant="outline" size="sm" onClick={handleAISuggest} disabled={aiLoading} className="font-semibold" style={{ color: C.primary, borderColor: C.primary + '50' }}>
              {aiLoading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
              AI Suggest
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setImportOpen(true); suggestAdvancedTour() }} className="font-semibold" style={{ color: C.muted, borderColor: C.borderMed }} data-tour="import-categories-btn">
            <Upload size={14} className="mr-1" />Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditTarget(null); setFormOpen(true) }} className="font-semibold">
            <Plus size={14} className="mr-1" />Add Category
          </Button>
        </div>
      </div>

      {aiError && <AlertBox severity="error" className="mt-3">{aiError}</AlertBox>}

      <div className="h-px mt-4" style={{ backgroundColor: C.hoverStrong }} />

      <CollapsibleSection
        title="Default Limits"
        subtitle="Monthly budget limits applied across all months."
        defaultOpen
      >
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
      </CollapsibleSection>

      <div data-tour="budget-plan">
        <BudgetPlan expenseTypes={expenseTypes} defaultLimits={limits} aiEnabled={aiEnabled} onAnalysis={setAnalysisCategory} onChanged={() => {
          setCurrentOverrides({})
          api.get('/budgets/monthly-overrides', { params: { month: currentMonth() } })
            .then(r => setCurrentOverrides(Object.fromEntries(r.data.map(b => [b.type, b.monthly_limit]))))
            .catch(() => {})
          queryClient.invalidateQueries({ queryKey: ['budgets'] })
          queryClient.invalidateQueries({ queryKey: ['analysis'] })
        }} />
      </div>
      <div data-tour="monthly-overrides">
        <MonthlyOverrides expenseTypes={expenseTypes} defaultLimits={limits}
          cycleStartDay={settings?.cycle_start_day} currentPeriodLabel={settings?.current_period?.period_label}
          onChanged={() => {
          setCurrentOverrides({})
          api.get('/budgets/monthly-overrides', { params: { month: currentMonth() } })
            .then(r => setCurrentOverrides(Object.fromEntries(r.data.map(b => [b.type, b.monthly_limit]))))
            .catch(() => {})
          queryClient.invalidateQueries({ queryKey: ['budgets'] })
          queryClient.invalidateQueries({ queryKey: ['analysis'] })
        }} />
      </div>
      <MacrocategoryManager />

      {aiRecsOpen && aiRecs.length > 0 && (
        <AIBudgetRecsDialog
          recommendations={aiRecs}
          onApply={handleAiApply}
          onClose={() => setAiRecsOpen(false)}
        />
      )}
      {importOpen && (
        <ImportBudgetsDialog
          onClose={() => setImportOpen(false)}
          onImported={async () => {
            setImportOpen(false)
            await reloadTypes()
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
            queryClient.invalidateQueries({ queryKey: ['analysis'] })
          }}
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
      {analysisCategory && (
        <CategoryAnalysisDialog
          typeName={analysisCategory.name}
          typeColor={analysisCategory.color}
          typeIcon={analysisCategory.icon}
          onClose={() => setAnalysisCategory(null)}
        />
      )}
    </Card>
  )
}
