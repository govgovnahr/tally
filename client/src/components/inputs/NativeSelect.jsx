import { useC } from '../../colors'

export default function NativeSelect({ value, onChange, children, disabled, className = '', style = {} }) {
  const C = useC()
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`h-9 rounded-lg border px-3 text-sm bg-transparent ${className}`}
      style={{ borderColor: C.borderLight, color: C.warmText, ...style }}
    >
      {children}
    </select>
  )
}
