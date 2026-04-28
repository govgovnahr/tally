import { useC } from '../colors'

export default function ToggleGroup({ value, onChange, options }) {
  const C = useC()
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.borderLight}` }}>
      {options.map(({ label, val }) => {
        const active = value === val
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className="text-xs font-medium px-3 py-1.5 bg-transparent border-none cursor-pointer transition-colors duration-150 font-[inherit] rounded-md"
            style={{
              color: active ? C.primary : C.muted,
              backgroundColor: active ? C.primaryTint : 'transparent',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
