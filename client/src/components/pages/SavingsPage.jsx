import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, PiggyBank, Pause, Play, Receipt, CheckCircle, ChevronDown, Sparkles, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api, { getErrorMessage } from '../../api.js'
import { qk } from '../../queryKeys.js'
import NetSavingsChart from '../charts/NetSavingsChart.jsx'
import { useC, palette, TYPE_PALETTE } from '../../colors'
import { useTutorial } from '../../TutorialContext.jsx'
import { Card } from 'glasscn-ui'
import AlertBox from '../ui/AlertBox.jsx'
import IconButton from '../ui/IconButton.jsx'
import ColorSwatch from '../ui/ColorSwatch.jsx'

const ONE_TIME_COLORS = TYPE_PALETTE.slice(0, 6)
const GOAL_COLORS = [...TYPE_PALETTE.slice(0, 5), '#A0722A', '#8B3A2A', palette.grey, '#f4a261', '#9b72cf']

function fmtMonth(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function trackingStatus(goal) {
  if (!goal.deadline || !goal.projected_completion || goal.completed || goal.paused) return null
  return goal.projected_completion <= goal.deadline ? 'on_track' : 'at_risk'
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


function ProgressBar({ value, color, height = 6 }) {
  const C = useC()
  return (
    <div className="rounded-full" style={{ height, backgroundColor: C.hoverStrong }}>
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
    </div>
  )
}


function CardActions({ goal, onEdit, onDelete, onPause }) {
  const C = useC()
  return (
    <div className="flex">
      <IconButton title={goal.paused ? 'Resume' : 'Pause'} onClick={onPause}>
        {goal.paused ? <Play size={14} /> : <Pause size={14} />}
      </IconButton>
      <IconButton title="Edit" onClick={onEdit}><Pencil size={14} /></IconButton>
      <IconButton title="Delete" onClick={onDelete} hoverColor={C.overBudget}><Trash2 size={14} /></IconButton>
    </div>
  )
}

// ─── Goal Cards ──────────────────────────────────────────────────────────────

function MonthlyGoalCard({ goal, onEdit, onDelete, onPause, onContribute }) {
  const C = useC()
  const cardColor = C.adaptColor(goal.color ?? C.income)
  const contributed = goal.monthly_contributions ?? 0
  const pct = goal.progress_pct

  return (
    <Card className="rounded-xl p-4 sm:p-5 mb-4" style={{
      border: `1px solid ${cardColor}${C.cardBorderAlpha}`,
      opacity: goal.paused ? 0.65 : 1,
    }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <PiggyBank size={17} style={{ color: cardColor }} />
          <span className="text-sm font-semibold" style={{ color: C.warmText }}>{goal.name}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ color: cardColor, borderColor: cardColor }}>Monthly</span>
          {goal.paused && <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ color: C.dimText, borderColor: C.dimText }}>Paused</span>}
        </div>
        <CardActions goal={goal} onEdit={onEdit} onDelete={onDelete} onPause={onPause} />
      </div>
      <div className="flex items-baseline gap-1.5 mb-1.5">
        <span className="text-2xl font-bold" style={{ color: C.warmText }}>${contributed.toFixed(2)}</span>
        <span className="text-sm" style={{ color: C.muted }}>/ ${goal.target.toFixed(2)} this month</span>
      </div>
      <div className="mb-3"><ProgressBar value={pct} color={cardColor} /></div>
      <div className="flex justify-end">
        <button type="button" onClick={onContribute}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-transparent cursor-pointer transition-colors duration-150"
          style={{ borderColor: cardColor, color: cardColor }}>
          <Receipt size={13} />Log contribution
        </button>
      </div>
    </Card>
  )
}

function OneTimeGoalCard({ goal, color: rawColor, onEdit, onDelete, onPause, onContribute, aiEnabled }) {
  const C = useC()
  const color = C.adaptColor(rawColor)
  const pct = goal.progress_pct
  const met = pct >= 100
  const isUnallocated = !goal.allocation_pct && !goal.priority

  const [coachOpen, setCoachOpen] = useState(false)
  const { data: coachData, isFetching: coachLoading } = useQuery({
    queryKey: qk.aiGoalCoach(goal.id),
    queryFn: () => api.get(`/ai/goal-coach/${goal.id}`).then(r => r.data),
    enabled: coachOpen,
    staleTime: 60 * 60_000,
    retry: false,
  })

  return (
    <Card className="rounded-xl p-4 sm:p-5" style={{
      border: `1px solid ${color}${C.cardBorderAlpha}`,
      opacity: goal.paused ? 0.65 : 1,
    }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold" style={{ color: C.warmText }}>{goal.name}</span>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {goal.deadline && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ color: C.muted, borderColor: C.borderMed }}>
                Due {fmtDeadline(goal.deadline)}
              </span>
            )}
            {goal.paused && <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ color: C.dimText, borderColor: C.dimText }}>Paused</span>}
            {(() => {
              const status = trackingStatus(goal)
              if (!status) return null
              const isOnTrack = status === 'on_track'
              return (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full border font-medium"
                    style={{ color: isOnTrack ? C.onTrack : C.overBudget, borderColor: isOnTrack ? C.onTrack : C.overBudget }}>
                    {isOnTrack ? 'On track' : 'At risk'}
                  </span>
                  {!isOnTrack && aiEnabled && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setCoachOpen(o => !o) }}
                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-transparent cursor-pointer transition-colors duration-150"
                      style={{ borderColor: C.primary, color: C.primary }}
                      onMouseEnter={ev => { ev.currentTarget.style.backgroundColor = `${C.primary}15` }}
                      onMouseLeave={ev => { ev.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <Sparkles size={10} />
                      Get advice
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
        <CardActions goal={goal} onEdit={onEdit} onDelete={onDelete} onPause={onPause} />
      </div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-xl font-bold" style={{ color: met ? C.primary : C.warmText }}>${goal.total_contributions.toFixed(2)}</span>
        <span className="text-sm" style={{ color: C.muted }}>/ ${goal.target.toFixed(2)}</span>
      </div>
      <div className="mb-3"><ProgressBar value={pct} color={met ? C.primary : color} /></div>
      {coachOpen && (
        <div className="mb-3 rounded-xl overflow-hidden"
          style={{ border: `1px solid ${C.primary}30`, backgroundColor: `${C.primary}08` }}>
          {coachLoading ? (
            <div className="flex items-center gap-2 p-3" style={{ color: C.muted }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">Building your plan…</span>
            </div>
          ) : coachData?.skip ? (
            <p className="text-sm p-3" style={{ color: C.muted }}>Not enough data to coach this goal yet. Log more contributions first.</p>
          ) : coachData ? (
            <div className="p-3 flex flex-col gap-3">
              <p className="text-sm font-medium" style={{ color: C.warmText }}>{coachData.summary}</p>
              <div className="flex flex-col gap-2">
                {coachData.options?.map(opt => (
                  <div key={opt.type} className="rounded-lg p-2.5"
                    style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: C.warmText }}>{opt.label}</p>
                    <p className="text-xs" style={{ color: C.muted }}>{opt.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
      <div className="flex items-end justify-between gap-2">
        <div>
          {met ? (
            <span className="text-sm" style={{ color: C.primary }}>Goal met!</span>
          ) : goal.projected_completion ? (
            <span className="text-sm" style={{ color: isUnallocated ? C.dimText : C.muted }}>
              {isUnallocated
                ? `~${fmtMonth(goal.projected_completion)} · estimated`
                : `Projected: ${fmtMonth(goal.projected_completion)}${goal.effective_avg_monthly_net > 0 ? ` · at $${goal.effective_avg_monthly_net.toFixed(0)}/mo` : ''}`
              }
            </span>
          ) : (
            <span className="text-sm" style={{ color: C.muted }}>Log contributions to see a projection</span>
          )}
        </div>
        <button type="button" onClick={onContribute}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-transparent cursor-pointer flex-shrink-0 transition-colors duration-150"
          style={{ borderColor: color, color }}>
          <Receipt size={13} />Log contribution
        </button>
      </div>
    </Card>
  )
}

function EmergencyFundGoalCard({ goal, color: rawColor, onEdit, onDelete, onPause, onContribute, aiEnabled }) {
  const C = useC()
  const color = C.adaptColor(rawColor)
  const pct = goal.progress_pct
  const met = pct >= 100

  const [coachOpen, setCoachOpen] = useState(false)
  const { data: coachData, isFetching: coachLoading } = useQuery({
    queryKey: qk.aiGoalCoach(goal.id),
    queryFn: () => api.get(`/ai/goal-coach/${goal.id}`).then(r => r.data),
    enabled: coachOpen,
    staleTime: 60 * 60_000,
    retry: false,
  })

  const isUnallocated = !goal.allocation_pct && !goal.priority

  return (
    <Card className="rounded-xl p-4 sm:p-5" style={{
      border: `1px solid ${color}${C.cardBorderAlpha}`,
      opacity: goal.paused ? 0.65 : 1,
    }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: C.warmText }}>{goal.name}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ color, borderColor: color }}>Emergency Fund</span>
          </div>
          <div className="flex gap-1.5 mt-1 flex-wrap">
            {goal.months_target && <span className="text-sm" style={{ color: C.muted }}>{goal.months_target} months of expenses</span>}
            {goal.deadline && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ color: C.muted, borderColor: C.borderMed }}>
                Due {fmtDeadline(goal.deadline)}
              </span>
            )}
            {goal.paused && <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ color: C.dimText, borderColor: C.dimText }}>Paused</span>}
            {(() => {
              const status = trackingStatus(goal)
              if (!status) return null
              const isOnTrack = status === 'on_track'
              return (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full border font-medium"
                    style={{ color: isOnTrack ? C.onTrack : C.overBudget, borderColor: isOnTrack ? C.onTrack : C.overBudget }}>
                    {isOnTrack ? 'On track' : 'At risk'}
                  </span>
                  {!isOnTrack && aiEnabled && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setCoachOpen(o => !o) }}
                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-transparent cursor-pointer transition-colors duration-150"
                      style={{ borderColor: C.primary, color: C.primary }}
                      onMouseEnter={ev => { ev.currentTarget.style.backgroundColor = `${C.primary}15` }}
                      onMouseLeave={ev => { ev.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <Sparkles size={10} />
                      Get advice
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
        <CardActions goal={goal} onEdit={onEdit} onDelete={onDelete} onPause={onPause} />
      </div>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-xl font-bold" style={{ color: met ? C.primary : C.warmText }}>${goal.total_contributions.toFixed(2)}</span>
        <span className="text-sm" style={{ color: C.muted }}>/ ${goal.target.toFixed(2)}</span>
      </div>
      <div className="mb-3"><ProgressBar value={pct} color={met ? C.primary : color} /></div>
      {coachOpen && (
        <div className="mb-3 rounded-xl overflow-hidden"
          style={{ border: `1px solid ${C.primary}30`, backgroundColor: `${C.primary}08` }}>
          {coachLoading ? (
            <div className="flex items-center gap-2 p-3" style={{ color: C.muted }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">Building your plan…</span>
            </div>
          ) : coachData?.skip ? (
            <p className="text-sm p-3" style={{ color: C.muted }}>Not enough data to coach this goal yet. Log more contributions first.</p>
          ) : coachData ? (
            <div className="p-3 flex flex-col gap-3">
              <p className="text-sm font-medium" style={{ color: C.warmText }}>{coachData.summary}</p>
              <div className="flex flex-col gap-2">
                {coachData.options?.map(opt => (
                  <div key={opt.type} className="rounded-lg p-2.5"
                    style={{ backgroundColor: C.surface, border: `1px solid ${C.border}` }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: C.warmText }}>{opt.label}</p>
                    <p className="text-xs" style={{ color: C.muted }}>{opt.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
      <div className="flex items-end justify-between gap-2">
        <div>
          {met ? (
            <span className="text-sm" style={{ color: C.primary }}>Goal met!</span>
          ) : goal.projected_completion ? (
            <span className="text-sm" style={{ color: isUnallocated ? C.dimText : C.muted }}>
              {isUnallocated ? `~${fmtMonth(goal.projected_completion)} · estimated` : `Projected: ${fmtMonth(goal.projected_completion)}`}
              {!isUnallocated && goal.effective_avg_monthly_net > 0 && ` · at $${goal.effective_avg_monthly_net.toFixed(0)}/mo`}
            </span>
          ) : (
            <span className="text-sm" style={{ color: C.muted }}>Log contributions to see a projection</span>
          )}
        </div>
        <button type="button" onClick={onContribute}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border bg-transparent cursor-pointer flex-shrink-0"
          style={{ borderColor: color, color }}>
          <Receipt size={13} />Log contribution
        </button>
      </div>
    </Card>
  )
}

function CompletedGoalCard({ goal, color, onDelete }) {
  const C = useC()
  const pct = goal.progress_pct

  return (
    <div className="rounded-xl p-3" style={{
      border: `1px solid ${color}${C.cardBorderAlpha}`,
      backgroundColor: `${color}${C.cardTintAlpha}`,
      opacity: 0.7,
    }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold" style={{ color: C.warmText }}>{goal.name}</span>
          <div className="flex gap-1.5 mt-1">
            {goal.expired ? (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full border" style={{ color: C.dimText, borderColor: C.dimText }}>Deadline passed</span>
            ) : (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full border flex items-center gap-1" style={{ color: C.primary, borderColor: C.primary }}>
                <CheckCircle size={10} />Goal met
              </span>
            )}
          </div>
        </div>
        <IconButton onClick={onDelete} hoverColor={C.overBudget}><Trash2 size={14} /></IconButton>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-sm font-semibold" style={{ color: C.muted }}>${(goal.total_contributions ?? 0).toFixed(2)}</span>
        <span className="text-xs" style={{ color: C.dimText }}>/ ${goal.target.toFixed(2)}</span>
      </div>
      <ProgressBar value={pct} color={pct >= 100 ? C.primary : color} height={4} />
    </div>
  )
}

// ─── Contribution Dialog ──────────────────────────────────────────────────────

function ContributionDialog({ open, onClose, goal }) {
  const C = useC()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [contribDate, setContribDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setError(''); setSuccess(false) }
  }, [open])

  function invalidateSavings() {
    queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['analysis'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  async function handleAdd() {
    const a = parseFloat(amount)
    if (!a || a <= 0) { setError('Amount must be greater than 0'); return }
    setSaving(true); setError(''); setSuccess(false)
    try {
      await api.post(`/savings-goals/${goal.id}/contributions`, { amount: a, date: contribDate, note: note.trim() || null })
      setAmount(''); setNote('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
      invalidateSavings()
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  async function handleDelete(contribId) {
    try { await api.delete(`/savings-goals/${goal.id}/contributions/${contribId}`); invalidateSavings() } catch { /* ignore */ }
  }

  const contributions = goal?.contributions ?? []

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Contributions — {goal?.name}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          {contributions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No contributions logged yet.</p>
          ) : (
            <div>
              {contributions.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2"
                  style={{ borderBottom: `1px solid ${C.hoverStrong}` }}>
                  <div>
                    <p className="text-sm font-medium">${c.amount.toFixed(2)}</p>
                    <p className="text-xs" style={{ color: C.muted }}>{fmtDate(c.date)}{c.note ? ` · ${c.note}` : ''}</p>
                  </div>
                  <IconButton onClick={() => handleDelete(c.id)} hoverColor={C.overBudget}><Trash2 size={14} /></IconButton>
                </div>
              ))}
            </div>
          )}
          <div className="h-px" style={{ backgroundColor: C.border }} />
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: C.muted }}>Log a contribution</p>
            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: C.muted }}>Amount ($)</label>
                <Input value={amount} onChange={e => setAmount(e.target.value)} type="number" min="0" step="0.01" className="w-32 h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs" style={{ color: C.muted }}>Date</label>
                <Input value={contribDate} onChange={e => setContribDate(e.target.value)} type="date" className="w-40 h-8 text-sm" />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                <label className="text-xs" style={{ color: C.muted }}>Note (optional)</label>
                <Input value={note} onChange={e => setNote(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            {error && <div className="mt-2"><AlertBox severity="error">{error}</AlertBox></div>}
            {success && <div className="mt-2"><AlertBox severity="success">Contribution added!</AlertBox></div>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={handleAdd} disabled={saving}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Goal Dialog ──────────────────────────────────────────────────────────────

function GoalDialog({ open, onClose, onSaved, existing, hasMonthlyGoal, portfolioAvg = 0, usedPct = 0 }) {
  const C = useC()
  const isEdit = !!existing
  const [goalType, setGoalType] = useState('one_time')
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState(GOAL_COLORS[0])
  const [monthsTarget, setMonthsTarget] = useState('3')
  const [avgExpenses, setAvgExpenses] = useState(null)
  const [allocationMode, setAllocationMode] = useState('none')
  const [allocationPct, setAllocationPct] = useState('')
  const [allocationPriority, setAllocationPriority] = useState('')
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
      setAllocationMode(existing?.allocation_pct != null ? 'pct' : existing?.priority != null ? 'priority' : 'none')
      setAllocationPct(existing?.allocation_pct?.toString() ?? '')
      setAllocationPriority(existing?.priority?.toString() ?? '')
      setError('')
    }
  }, [open, existing])

  useEffect(() => {
    if (goalType === 'emergency_fund') {
      api.get('/analysis/avg-monthly-expenses').then(r => setAvgExpenses(r.data.avg_monthly_expenses))
    }
  }, [goalType])

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required'); return }
    let t = null; let months_target_val = null
    if (goalType === 'emergency_fund') {
      const mt = parseInt(monthsTarget)
      if (!mt || mt <= 0) { setError('Months target must be at least 1'); return }
      months_target_val = mt
    } else {
      t = parseFloat(target)
      if (!t || t <= 0) { setError('Target must be greater than 0'); return }
    }
    setSaving(true); setError('')
    try {
      const isOneTimeLike = goalType === 'one_time' || goalType === 'emergency_fund'
      const resolvedAllocationPct = isOneTimeLike && allocationMode === 'pct' ? parseFloat(allocationPct) || null : null
      const resolvedPriority = isOneTimeLike && allocationMode === 'priority' ? parseInt(allocationPriority) || null : null
      const body = {
        goal_type: goalType, name: name.trim(), target: t,
        deadline: isOneTimeLike && deadline ? deadline : null,
        color,
        allocation_pct: resolvedAllocationPct,
        priority: resolvedPriority,
        months_target: months_target_val,
      }
      if (isEdit) {
        await api.put(`/savings-goals/${existing.id}`, {
          name: body.name, target: body.target, deadline: body.deadline, color,
          allocation_pct: resolvedAllocationPct, priority: resolvedPriority,
          paused: existing.paused ?? false, months_target: body.months_target,
        })
      } else {
        await api.post('/savings-goals', body)
      }
      onSaved()
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{isEdit ? 'Edit Goal' : 'New Savings Goal'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 pt-1">
          {!isEdit && (
            <div>
              <p className="text-xs mb-2" style={{ color: C.muted }}>Goal type</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { value: 'monthly', label: 'Monthly recurring', disabled: hasMonthlyGoal },
                  { value: 'one_time', label: 'One-time goal', disabled: false },
                  { value: 'emergency_fund', label: 'Emergency fund', disabled: false },
                ].map(({ value, label, disabled }) => (
                  <label key={value} className={`flex items-center gap-2 text-sm cursor-pointer ${disabled ? 'opacity-40' : ''}`}>
                    <input type="radio" value={value} checked={goalType === value} onChange={() => !disabled && setGoalType(value)}
                      disabled={disabled} className="accent-current" style={{ accentColor: C.primary }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder={goalType === 'monthly' ? 'e.g. Monthly savings target' : 'e.g. Vacation fund'} />
          </div>

          <div>
            <p className="text-xs mb-2" style={{ color: C.muted }}>Color</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLORS.map(c => <ColorSwatch key={c} color={c} selected={color === c} onClick={() => setColor(c)} size={22} />)}
            </div>
          </div>

          {goalType === 'emergency_fund' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Months of expenses to cover</label>
              <Input value={monthsTarget} onChange={e => setMonthsTarget(e.target.value)} type="number" min="1" step="1" />
              {avgExpenses !== null && (
                <p className="text-sm" style={{ color: C.muted }}>
                  {(() => {
                    const mt = parseInt(monthsTarget)
                    if (!mt || mt <= 0) return `3-mo avg: $${avgExpenses.toFixed(0)}/mo`
                    return `≈ $${(mt * avgExpenses).toFixed(0)} target (${mt}× $${avgExpenses.toFixed(0)}/mo avg)`
                  })()}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Target amount ($)</label>
              <Input value={target} onChange={e => setTarget(e.target.value)} type="number" min="0" step="0.01" />
            </div>
          )}

          {goalType === 'one_time' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Deadline (optional)</label>
              <Input value={deadline} onChange={e => setDeadline(e.target.value)} type="date" />
            </div>
          )}

          {(goalType === 'one_time' || goalType === 'emergency_fund') && (
            <div>
              <p className="text-xs mb-2" style={{ color: C.muted }}>Funding strategy</p>
              <div className="flex flex-col gap-2">
                {[
                  { value: 'none', label: 'None' },
                  { value: 'pct', label: '% of monthly net' },
                  { value: 'priority', label: 'Priority queue' },
                ].map(({ value, label }) => (
                  <div key={value}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" value={value} checked={allocationMode === value}
                        onChange={() => setAllocationMode(value)}
                        className="accent-current" style={{ accentColor: C.primary }} />
                      {label}
                    </label>
                    {allocationMode === 'none' && value === 'none' && (
                      <p className="mt-1 ml-5 text-xs" style={{ color: C.dimText }}>
                        Projection uses your full avg net — may be optimistic if you have multiple goals
                      </p>
                    )}
                    {allocationMode === 'pct' && value === 'pct' && (
                      <div className="mt-2 ml-5 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Input value={allocationPct} onChange={e => setAllocationPct(e.target.value)}
                            type="number" min="0.1" max="100" step="0.1"
                            className="w-20 h-8 text-sm" placeholder="10" />
                          <span className="text-sm" style={{ color: C.muted }}>%</span>
                          {portfolioAvg > 0 && parseFloat(allocationPct) > 0 && (
                            <span className="text-sm font-medium" style={{ color: C.warmText }}>
                              ≈ ${(portfolioAvg * parseFloat(allocationPct) / 100).toFixed(0)}/mo
                            </span>
                          )}
                        </div>
                        {portfolioAvg > 0 && (
                          <p className="text-xs" style={{
                            color: usedPct + (parseFloat(allocationPct) || 0) > 100 ? C.overBudget : C.dimText,
                          }}>
                            {usedPct > 0
                              ? `${usedPct.toFixed(0)}% already allocated · ${Math.max(0, 100 - usedPct).toFixed(0)}% remaining`
                              : `Avg net $${portfolioAvg.toFixed(0)}/mo`}
                            {usedPct + (parseFloat(allocationPct) || 0) > 100 && ' · priority goals may receive no funding'}
                          </p>
                        )}
                      </div>
                    )}
                    {allocationMode === 'priority' && value === 'priority' && (
                      <div className="mt-2 ml-5 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Input value={allocationPriority} onChange={e => setAllocationPriority(e.target.value)}
                            type="number" min="1" step="1"
                            className="w-20 h-8 text-sm" placeholder="1" />
                          <span className="text-sm" style={{ color: C.muted }}>rank</span>
                        </div>
                        <p className="text-xs" style={{ color: C.dimText }}>
                          Lower rank fills first · draws from{' '}
                          {usedPct > 0
                            ? `~$${Math.max(0, portfolioAvg * (1 - usedPct / 100)).toFixed(0)}/mo after % goals`
                            : `~$${portfolioAvg.toFixed(0)}/mo`}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {goalType === 'monthly' && (
            <p className="text-sm" style={{ color: C.muted }}>Progress tracks contributions logged this month toward your target.</p>
          )}
          {(goalType === 'one_time' || goalType === 'emergency_fund') && !isEdit && (
            <p className="text-sm" style={{ color: C.muted }}>Progress tracks cumulative contributions logged toward this goal.</p>
          )}

          {error && <AlertBox severity="error">{error}</AlertBox>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{isEdit ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirmDialog({ open, onClose, onConfirm, goalName }) {
  const C = useC()
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Delete goal?</DialogTitle></DialogHeader>
        <p className="text-sm" style={{ color: C.muted }}>
          "{goalName}" and all its contributions will be permanently deleted. Linked expenses will remain in your expense history. This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SavingsPage() {
  const C = useC()
  const queryClient = useQueryClient()
  const { suggestOnboardingTour } = useTutorial() ?? {}
  useEffect(() => { suggestOnboardingTour?.() }, [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [deletingGoal, setDeletingGoal] = useState(null)
  const [contributingToGoalId, setContributingToGoalId] = useState(null)
  const [completedOpen, setCompletedOpen] = useState(false)

  const { data: goals = [] } = useQuery({
    queryKey: qk.savingsGoals(),
    queryFn: () => api.get('/savings-goals').then(r => r.data),
    staleTime: 2 * 60_000,
  })

  const { data: settings } = useQuery({
    queryKey: qk.settings(),
    queryFn: () => api.get('/settings').then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const aiEnabled = settings?.ai_enabled ?? true

  const { data: monthlyGoalData } = useQuery({
    queryKey: qk.savingsGoalsMonthlyGoal(),
    queryFn: () => api.get('/savings-goals/monthly-goal').then(r => r.data),
    staleTime: 5 * 60_000,
  })
  const monthlyTarget = monthlyGoalData?.target ?? null

  function invalidateSavings() {
    queryClient.invalidateQueries({ queryKey: ['savings-goals'] })
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['analysis'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const monthlyGoal = goals.find(g => g.goal_type === 'monthly') ?? null
  const oneTimeGoals = goals.filter(g => (g.goal_type === 'one_time' || g.goal_type === 'emergency_fund') && !g.completed && !g.expired)
  const completedGoals = goals.filter(g => (g.goal_type === 'one_time' || g.goal_type === 'emergency_fund') && (g.completed || g.expired))
  const hasMonthlyGoal = !!monthlyGoal
  const activeContribGoal = contributingToGoalId ? goals.find(g => g.id === contributingToGoalId) ?? null : null
  const portfolioAvg = goals.find(g => g.avg_monthly_net != null)?.avg_monthly_net ?? 0
  const usedPct = goals
    .filter(g => !g.completed && !g.expired && !g.paused && g.allocation_pct != null && g.id !== editingGoal?.id)
    .reduce((s, g) => s + (g.allocation_pct ?? 0), 0)

  async function handleDelete() {
    if (!deletingGoal) return
    await api.delete(`/savings-goals/${deletingGoal.id}`)
    setDeletingGoal(null); invalidateSavings()
  }

  async function handlePause(goalId) {
    await api.patch(`/savings-goals/${goalId}/pause`); invalidateSavings()
  }

  return (
    <div data-tour="goals-list">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: C.warmText }}>Savings Goals</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>Track monthly net savings and long-term targets</p>
        </div>
        <Button onClick={() => { setEditingGoal(null); setDialogOpen(true) }} className="font-semibold flex-shrink-0">
          <Plus size={15} className="mr-1" />Add Goal
        </Button>
      </div>

      <NetSavingsChart monthlyTarget={monthlyTarget} goals={goals} />

      {monthlyGoal && (
        <MonthlyGoalCard
          goal={monthlyGoal}
          onEdit={() => { setEditingGoal(monthlyGoal); setDialogOpen(true) }}
          onDelete={() => setDeletingGoal(monthlyGoal)}
          onPause={() => handlePause(monthlyGoal.id)}
          onContribute={() => setContributingToGoalId(monthlyGoal.id)}
        />
      )}

      {oneTimeGoals.length > 0 && (
        <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {oneTimeGoals.map((goal, i) => {
            const color = goal.color ?? ONE_TIME_COLORS[i % ONE_TIME_COLORS.length]
            const commonProps = {
              goal, color,
              onEdit: () => { setEditingGoal(goal); setDialogOpen(true) },
              onDelete: () => setDeletingGoal(goal),
              onPause: () => handlePause(goal.id),
              onContribute: () => setContributingToGoalId(goal.id),
              aiEnabled,
            }
            return goal.goal_type === 'emergency_fund'
              ? <EmergencyFundGoalCard key={goal.id} {...commonProps} />
              : <OneTimeGoalCard key={goal.id} {...commonProps} />
          })}
        </div>
      )}

      {completedGoals.length > 0 && (
        <div className="mt-5 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
            onClick={() => setCompletedOpen(o => !o)}>
            <CheckCircle size={15} style={{ color: C.primary }} />
            <span className="text-sm font-medium" style={{ color: C.muted }}>Completed ({completedGoals.length})</span>
            <ChevronDown size={14} className="ml-auto transition-transform duration-200"
              style={{ color: C.muted, transform: completedOpen ? 'rotate(180deg)' : 'none' }} />
          </div>
          <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: completedOpen ? '9999px' : '0px' }}>
            <div className="grid gap-3 p-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {completedGoals.map((goal, i) => (
                <CompletedGoalCard
                  key={goal.id}
                  goal={goal}
                  color={goal.color ?? ONE_TIME_COLORS[i % ONE_TIME_COLORS.length]}
                  onDelete={() => setDeletingGoal(goal)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {goals.length === 0 && (
        <div className="rounded-xl py-16 text-center" style={{ border: `1px solid ${C.border}` }}>
          <PiggyBank size={40} className="mx-auto mb-3" style={{ color: C.dimText }} />
          <p className="text-sm" style={{ color: C.muted }}>No savings goals yet. Add one to start tracking.</p>
        </div>
      )}

      <GoalDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); invalidateSavings() }}
        existing={editingGoal}
        hasMonthlyGoal={hasMonthlyGoal && !editingGoal}
        portfolioAvg={portfolioAvg}
        usedPct={usedPct}
      />
      <DeleteConfirmDialog open={!!deletingGoal} onClose={() => setDeletingGoal(null)} onConfirm={handleDelete} goalName={deletingGoal?.name ?? ''} />
      <ContributionDialog open={!!contributingToGoalId} onClose={() => setContributingToGoalId(null)} goal={activeContribGoal} />
    </div>
  )
}
