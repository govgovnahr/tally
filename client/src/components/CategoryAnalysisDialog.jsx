import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import api from '../api.js'
import { useC } from '../colors'
import { ICON_REGISTRY } from '../expenseTypes.js'

export default function CategoryAnalysisDialog({ typeName, typeColor, typeIcon, onClose }) {
  const C = useC()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analysis/category-stats', { params: { months: 6 } })
      .then(r => setData(r.data.find(d => d.type === typeName) ?? null))
      .finally(() => setLoading(false))
  }, [typeName])

  const IconComp = typeIcon ? ICON_REGISTRY[typeIcon] : null
  const catColor = C.adaptColor(typeColor ?? C.primary)

  const trendIcon = data?.trend === 'up'
    ? <TrendingUp size={14} style={{ color: C.trendUp }} />
    : data?.trend === 'down'
      ? <TrendingDown size={14} style={{ color: C.trendDown }} />
      : <Minus size={14} style={{ color: C.dimText }} />

  const chartData = (data?.monthly ?? []).map(m => ({
    label: new Date(m.month + '-02').toLocaleString('en-US', { month: 'short' }),
    total: m.total,
  }))

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                {IconComp && <IconComp style={{ fontSize: 16, color: catColor }} />}
                <span>{typeName}</span>
                {data && <span className="flex items-center">{trendIcon}</span>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full border-none cursor-pointer transition-colors duration-150 flex-shrink-0"
                style={{ color: C.muted, backgroundColor: 'transparent' }}
              >
                <X size={16} />
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm py-4" style={{ color: C.muted }}>Loading…</p>
        ) : !data ? (
          <p className="text-sm py-4" style={{ color: C.muted }}>No data in the last 6 months.</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Avg/month', value: `$${data.avg_monthly.toFixed(0)}` },
                { label: 'Budget', value: data.budget_limit ? `$${data.budget_limit.toFixed(0)}` : 'None set' },
                {
                  label: 'Over budget',
                  value: data.budget_limit ? `${data.months_over}/${data.months_total} mo` : '—',
                  color: data.budget_limit && data.months_over > 0 ? C.overBudget : C.warmText,
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: C.subtleBg, border: `1px solid ${C.borderSubtle}` }}>
                  <p className="text-[11px] mb-1" style={{ color: C.muted }}>{label}</p>
                  <p className="text-sm font-semibold" style={{ color: color ?? C.warmText }}>{value}</p>
                </div>
              ))}
            </div>

            {chartData.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: C.muted }}>Monthly spending (last 6 months)</p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.gridLine} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.dimText, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.dimText, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                      formatter={v => [`$${Number(v).toFixed(2)}`, 'Spent']}
                      labelStyle={{ color: C.warmText }}
                    />
                    <Bar dataKey="total" fill={catColor} radius={[4, 4, 0, 0]} barSize={22} />
                    {data.budget_limit && (
                      <ReferenceLine
                        y={data.budget_limit}
                        stroke={C.overBudget}
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{ value: `$${data.budget_limit.toFixed(0)}`, position: 'insideTopRight', fill: C.overBudget, fontSize: 10, dy: -4 }}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {data.months_over > 0 && data.avg_overage > 0 && (
              <p className="text-sm" style={{ color: C.muted }}>
                Avg overage when over budget:{' '}
                <strong style={{ color: C.overBudget }}>${data.avg_overage.toFixed(0)}/mo</strong>
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
