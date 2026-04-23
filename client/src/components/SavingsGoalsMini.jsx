import { useC } from '../colors'

function shortMonth(ym) {
  if (!ym) return null
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export default function SavingsGoalsMini({ goals, onNavigate }) {
  const C = useC()
  const active = goals.filter(g => !g.completed && !g.paused).slice(0, 3)

  if (!active.length) {
    return (
      <div className="py-1">
        <span className="text-sm" style={{ color: C.muted }}>
          No active goals.{' '}
          <button
            type="button"
            onClick={() => onNavigate('savings')}
            className="text-sm bg-transparent border-none cursor-pointer font-[inherit] align-baseline hover:underline"
            style={{ color: C.primary }}
          >
            Set one up →
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {active.map(g => {
        const pct = g.target > 0 ? Math.min((g.effective_progress / g.target) * 100, 100) : 0
        const color = g.color ?? C.primary
        return (
          <div key={g.id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <p className="text-sm font-semibold truncate">{g.name}</p>
              </div>
              <span className="text-xs flex-shrink-0 ml-2" style={{ color: C.muted }}>
                {pct.toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: C.hoverStrong }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            {(g.goal_type === 'one_time' || g.goal_type === 'emergency_fund')
              ? g.projected_completion && (
                  <p className="text-[11px] mt-1" style={{ color: C.muted }}>~{shortMonth(g.projected_completion)}</p>
                )
              : g.goal_type === 'monthly' && g.monthly_contributions != null && g.target > 0
                ? <p className="text-[11px] mt-1" style={{ color: C.muted }}>${g.monthly_contributions.toFixed(0)} of ${g.target.toFixed(0)} this month</p>
                : null
            }
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onNavigate('savings')}
        className="self-start text-xs font-semibold mt-1 bg-transparent border-none cursor-pointer font-[inherit] hover:underline"
        style={{ color: C.primary }}
      >
        View all →
      </button>
    </div>
  )
}
