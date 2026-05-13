export const BADGE_TOKENS = {
  well_under:  { backgroundColor: 'var(--color-under-budget-bg)', color: 'var(--color-under-budget-text)', border: '1px solid var(--color-under-budget-border)' },
  on_track:    { backgroundColor: 'var(--color-on-track-bg)',     color: 'var(--color-on-track-text)',     border: '1px solid var(--color-on-track-border)' },
  at_risk:     { backgroundColor: 'var(--color-warning-bg)',      color: 'var(--color-warning-text)',      border: '1px solid var(--color-warning-border)' },
  over_budget: { backgroundColor: 'var(--color-over-budget-bg)', color: 'var(--color-over-budget-text)', border: '1px solid var(--color-over-budget-border)' },
  no_budget:   { backgroundColor: 'var(--color-no-limit-bg)',    color: 'var(--color-no-limit-text)',    border: '1px solid var(--color-no-limit-border)' },
}

const STATUS_LABELS = {
  well_under:  'Under budget',
  on_track:    'On track',
  at_risk:     'At risk',
  over_budget: 'Over budget',
  no_budget:   'No budget',
}

export default function StatusBadge({ status, label }) {
  const style = BADGE_TOKENS[status] ?? BADGE_TOKENS.no_budget
  return (
    <span
      className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={style}
    >
      {label ?? STATUS_LABELS[status]}
    </span>
  )
}
