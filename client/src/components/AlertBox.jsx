import { useC } from '../colors'

export default function AlertBox({ severity = 'error', children }) {
  const C = useC()
  const colors = {
    error:   { bg: `${C.overBudget}15`, border: `${C.overBudget}40`, text: C.overBudget },
    warning: { bg: `${C.atRisk}15`, border: `${C.atRisk}40`, text: C.atRisk },
    success: { bg: `${C.onTrack}15`, border: `${C.onTrack}40`, text: C.onTrack },
  }
  const s = colors[severity] ?? colors.error
  return (
    <div className="text-sm px-3 py-2 rounded-lg"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
      {children}
    </div>
  )
}

export function ErrorMsg({ msg }) {
  if (!msg) return null
  return <AlertBox severity="error">{msg}</AlertBox>
}
