import { useState } from 'react'
import { useC } from '../../colors'

export default function PolishedCheckbox({ checked, onChange, label, accentColor }) {
  const C = useC()
  const accent = accentColor ?? C.primary
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={() => onChange(!checked)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${checked ? accent + '55' : C.hoverStrong}`,
        backgroundColor: checked ? accent + '18' : hovered ? C.subtleBg : 'transparent',
      }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors duration-150 active:scale-[0.99]"
    >
      <div
        style={{
          border: `1.5px solid ${checked ? 'transparent' : C.borderStrong}`,
          backgroundColor: checked ? accent : 'transparent',
        }}
        className="w-5 h-5 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-colors duration-150"
      >
        {checked && (
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
            <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span
        style={{ fontWeight: checked ? 500 : 400, color: checked ? C.warmText : C.muted }}
        className="text-sm transition-colors duration-150"
      >
        {label}
      </span>
    </div>
  )
}
