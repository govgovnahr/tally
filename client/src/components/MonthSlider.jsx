import { useC } from '../colors'

export default function MonthSlider({ value, onChange, max, min = 1 }) {
  const C = useC()
  const pct = max <= min ? 100 : ((value - min) / (max - min)) * 100

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{min}M</span>
      <div className="relative flex items-center flex-1 min-w-[80px]">
        <input
          type="range"
          className="month-slider flex-1"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, ${C.primary} 0%, ${C.primary} ${pct}%, ${C.hoverStrong} ${pct}%, ${C.hoverStrong} 100%)`,
          }}
        />
      </div>
      <span className="text-xs flex-shrink-0" style={{ color: C.muted }}>{max}M</span>
      <span
        className="text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: C.primaryTint, color: C.primary }}
      >
        {value}M
      </span>
    </div>
  )
}
