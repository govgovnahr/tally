import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { useC } from '../colors'

export default function OutlierAlert({ count, onSeeDetails }) {
  const C = useC()
  const [btnHovered, setBtnHovered] = useState(false)

  return (
    <div
      style={{
        backgroundColor: `${C.atRisk}18`,
        border: `1px solid ${C.atRisk}40`,
      }}
      className="flex items-center justify-between flex-wrap gap-2 rounded-2xl px-4 py-3 mb-4"
    >
      <div className="flex items-center gap-2">
        <TriangleAlert size={18} style={{ color: C.atRisk }} />
        <span className="text-sm font-semibold" style={{ color: C.atRisk }}>
          {count} unusual {count === 1 ? 'expense' : 'expenses'} detected this month
        </span>
      </div>
      <button
        type="button"
        onClick={onSeeDetails}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        style={{
          color: C.atRisk,
          backgroundColor: btnHovered ? `${C.atRisk}18` : 'transparent',
        }}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer border-none font-[inherit]"
      >
        See details →
      </button>
    </div>
  )
}
