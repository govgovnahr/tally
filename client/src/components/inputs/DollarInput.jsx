import { useC } from '../../colors'
import { Input } from '@/components/ui/input'

export default function DollarInput({
  value, onChange, placeholder = 'No limit',
  step = '0.01', min = '0', disabled,
  className = '', inputClassName = 'h-9 w-full',
}) {
  const C = useC()
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: C.muted }}>$</span>
      <Input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`pl-7 text-right text-sm ${inputClassName}`}
        min={min}
        step={step}
      />
    </div>
  )
}
