import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { useC } from '../colors'

function shortDate(d) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

export default function RecentTransactions({ transactions, onNavigate }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()

  if (!transactions.length) {
    return <p className="text-sm" style={{ color: C.muted }}>No transactions this month.</p>
  }

  return (
    <div className="flex flex-col">
      {transactions.map(t => {
        const color = C.adaptColor(typeMap[t.expense_type]?.color ?? C.dimText)
        return (
          <div
            key={t.id}
            className="flex items-center gap-3 py-2"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight">{t.name}</p>
              <span className="text-xs leading-tight" style={{ color: C.muted }}>
                {shortDate(t.date)} · {t.expense_type}
              </span>
            </div>
            <span className="text-sm font-semibold flex-shrink-0">${t.amount.toFixed(2)}</span>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onNavigate('all-expenses')}
        className="self-start mt-2 text-xs font-semibold bg-transparent border-none cursor-pointer font-[inherit] hover:underline"
        style={{ color: C.primary }}
      >
        View all →
      </button>
    </div>
  )
}
