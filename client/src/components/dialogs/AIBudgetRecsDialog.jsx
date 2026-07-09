import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useC } from '../../colors'
import { useExpenseTypes } from '../../ExpenseTypesContext.jsx'
import { ICON_REGISTRY } from '../../expenseTypes.js'

export default function AIBudgetRecsDialog({
  recommendations, onApply, onClose,
  title = 'AI Budget Recommendations',
  subtitle = 'Based on your last 3 months of spending. Uncheck any to skip.',
  baseTotal = null,
}) {
  const C = useC()
  const { expenseTypes } = useExpenseTypes()
  const [selected, setSelected] = useState(() => new Set(recommendations.map(r => r.type)))

  const typeMap = Object.fromEntries(expenseTypes.map(t => [t.name, t]))

  function toggle(type) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  function handleApply() {
    const limitsMap = Object.fromEntries(
      recommendations.filter(r => selected.has(r.type)).map(r => [r.type, r.recommended_limit])
    )
    onApply(limitsMap)
  }

  const count = selected.size
  const projectedTotal = baseTotal != null
    ? baseTotal - recommendations.reduce((sum, r) => sum + (selected.has(r.type) ? r.current_limit - r.recommended_limit : 0), 0)
    : null

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: C.warmText }}>
            <Sparkles size={15} style={{ color: C.primary }} />
            {title}
          </DialogTitle>
          <p className="text-xs mt-1" style={{ color: C.muted }}>
            {subtitle}
          </p>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-2 py-1 pr-1">
          {recommendations.map(rec => {
            const t = typeMap[rec.type]
            const IconComp = t?.icon ? ICON_REGISTRY[t.icon] : null
            const tColor = t ? C.adaptColor(t.color) : C.primary
            const isOn = selected.has(rec.type)

            return (
              <div
                key={rec.type}
                onClick={() => toggle(rec.type)}
                className="rounded-xl p-3 cursor-pointer select-none"
                style={{
                  backgroundColor: isOn ? `${tColor}10` : C.surfaceAlt,
                  border: `1px solid ${isOn ? tColor + '30' : C.borderLight}`,
                  opacity: isOn ? 1 : 0.5,
                  transition: 'opacity 0.15s, background-color 0.15s',
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isOn}
                    onChange={() => toggle(rec.type)}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: tColor, flexShrink: 0 }}
                  />
                  {IconComp && <IconComp style={{ fontSize: 15, color: tColor, flexShrink: 0 }} />}
                  <span className="text-sm font-medium flex-1 truncate" style={{ color: C.warmText }}>{rec.type}</span>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-semibold" style={{ color: tColor }}>
                      ${rec.recommended_limit.toFixed(0)}/mo
                    </span>
                    {rec.current_limit > 0 && (
                      <span className="text-[10px] ml-1.5" style={{ color: C.dimText }}>
                        was ${rec.current_limit.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
                {rec.avg_spend > 0 && (
                  <p className="mt-0.5 ml-[22px] text-[11px]" style={{ color: C.dimText }}>
                    avg ${rec.avg_spend.toFixed(0)}/mo
                  </p>
                )}
                {rec.rationale && (
                  <p className="mt-0.5 ml-[22px] text-[11px] italic" style={{ color: C.muted }}>
                    {rec.rationale}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {projectedTotal != null && (
          <div className="text-xs px-1" style={{ color: C.primary }}>
            New total: ${projectedTotal.toFixed(0)}
          </div>
        )}

        <DialogFooter className="mt-3 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} style={{ color: C.muted, borderColor: C.borderMed }}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={count === 0} className="font-semibold">
            Apply {count} limit{count !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
