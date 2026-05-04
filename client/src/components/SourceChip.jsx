import { useC } from '../colors'

export default function SourceChip({ creditType }) {
  const C = useC()
  return creditType ? (
    <span className="text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{ color: C.nearGoal, borderColor: C.nearGoal }}>
      Credit → {creditType}
    </span>
  ) : (
    <span className="text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap"
      style={{ color: C.income, borderColor: C.income }}>
      Income
    </span>
  )
}
