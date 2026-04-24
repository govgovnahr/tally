import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { useC } from '../colors'

function fmt(n) { return `$${n.toFixed(2)}` }

function CustomTooltip({ active, payload }) {
  const C = useC()
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ backgroundColor: C.surfacePopup, border: `1px solid ${C.border}` }}
    >
      <p className="text-sm font-semibold">{d.name}</p>
      <span className="text-xs" style={{ color: C.muted }}>{fmt(d.value)} · {d.pct}%</span>
    </div>
  )
}

export default function SpendingDonut({ summary, activeType, onTypeChange }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()
  const [hoveredName, setHoveredName] = useState(null)

  const total = summary.reduce((s, x) => s + x.total, 0)
  if (!summary.length || total === 0) {
    return (
      <div className="flex items-center justify-center h-[140px]">
        <p className="text-sm" style={{ color: C.muted }}>No spending this month</p>
      </div>
    )
  }

  const data = [...summary]
    .sort((a, b) => b.total - a.total)
    .map(s => ({
      name: s.type,
      value: s.total,
      pct: ((s.total / total) * 100).toFixed(1),
      color: typeMap[s.type]?.color ?? C.dimText,
    }))

  const selected = activeType && activeType !== 'All' ? activeType : null

  function handleClick(type) {
    onTypeChange?.(selected === type ? 'All' : type)
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Donut */}
      <div className="relative w-40 h-40 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={72}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
              style={{ cursor: 'pointer' }}
              onClick={(_, index) => handleClick(data[index].name)}
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.color}
                  opacity={selected && selected !== d.name ? 0.3 : 1}
                  stroke={selected === d.name ? d.color : 'none'}
                  strokeWidth={selected === d.name ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <p className="text-sm font-bold leading-tight" style={{ fontSize: '0.9rem' }}>
            {selected ? fmt(data.find(d => d.name === selected)?.value ?? 0) : fmt(total)}
          </p>
          <span className="text-[10px] leading-tight" style={{ color: C.muted, fontSize: '0.65rem' }}>
            {selected ? selected : 'total'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-0 w-full sm:w-auto">
        {data.map((d, i) => {
          const isActive = selected === d.name
          const isHovered = hoveredName === d.name
          return (
            <div
              key={i}
              onClick={() => handleClick(d.name)}
              onMouseEnter={() => setHoveredName(d.name)}
              onMouseLeave={() => setHoveredName(null)}
              style={{
                opacity: selected && !isActive ? 0.45 : 1,
                backgroundColor: isActive ? `${d.color}18` : isHovered ? `${d.color}14` : 'transparent',
              }}
              className="flex items-center gap-2 min-w-0 cursor-pointer px-1.5 py-0.5 rounded-lg transition-all duration-150"
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span
                className="flex-1 text-xs truncate"
                style={{ color: C.muted, fontWeight: isActive ? 600 : 400 }}
              >
                {d.name}
              </span>
              <span
                className="text-xs font-semibold flex-shrink-0"
                style={{ color: isActive ? d.color : C.warmText }}
              >
                {d.pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
