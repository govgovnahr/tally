import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Sparkles } from 'lucide-react'
import { Card } from 'glasscn-ui'
import api from '../../api.js'
import { qk } from '../../queryKeys.js'
import { useC } from '../../colors'

const PAGE_LABELS = {
  expenses: 'View expenses',
  savings: 'View savings',
  budget: 'View budget',
  analysis: 'View analysis',
}

function ShimmerRow({ C }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.border, flexShrink: 0 }} />
      <div style={{ flex: 1, height: 13, borderRadius: 6, background: C.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
    </div>
  )
}

export default function AIInsightsCard({ onNavigate }) {
  const C = useC()

  const { data: settings } = useQuery({
    queryKey: qk.settings(),
    queryFn: () => api.get('/settings').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const aiEnabled = settings?.ai_enabled ?? true

  const { data: insights = [], isLoading, isError } = useQuery({
    queryKey: qk.aiInsights(),
    queryFn: () => api.get('/ai/insights').then(r => r.data),
    staleTime: 10 * 60_000,
    enabled: aiEnabled,
    retry: false,
  })

  if (!aiEnabled || isError || (!isLoading && insights.length === 0)) return null

  const sentimentColor = (s) => {
    if (s === 'positive') return C.onTrack
    if (s === 'warning') return C.overBudget
    return C.muted
  }

  return (
    <Card className="rounded-xl p-4 sm:p-5 mb-4">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <Sparkles size={13} color={C.primary} />
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: C.muted, margin: 0 }}>
          Tally AI
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <>
            <ShimmerRow C={C} />
            <div style={{ height: 1, background: C.hoverStrong }} />
            <ShimmerRow C={C} />
            <div style={{ height: 1, background: C.hoverStrong }} />
            <ShimmerRow C={C} />
          </>
        ) : (
          insights.map((insight, i) => (
            <div key={i}>
              {i > 0 && <div style={{ height: 1, background: C.hoverStrong }} />}
              <button
                type="button"
                onClick={() => onNavigate(insight.page)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: sentimentColor(insight.sentiment), flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: C.warmText, lineHeight: 1.4 }}>
                    {insight.text}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>
                    {PAGE_LABELS[insight.page] ?? 'View details'} →
                  </p>
                </div>
                <ChevronRight size={14} color={C.muted} style={{ flexShrink: 0 }} />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
