import { useC } from '../../colors'

export default function InferenceBadge({ source }) {
  const C = useC()

  const SOURCE_CONFIG = {
    rule:           { label: 'Your Rule',     color: C.primary },
    ai:             { label: 'AI',            color: C.income },
    file:           { label: 'From File',     color: C.nearGoal },
    keyword:        { label: 'Keyword',       color: C.muted },
    fallback:       { label: 'Unmatched',     color: C.overBudget },
    user:           { label: 'You changed',   color: C.spent },
    plaid_category: { label: 'Bank Category', color: C.nearGoal },
  }

  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.fallback
  const { label, color } = cfg

  return (
    <span
      className="text-[11px] font-medium px-1.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{
        color,
        borderColor: color,
        backgroundColor: color + '1f',
      }}
    >
      {label}
    </span>
  )
}
