import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useC } from '../../colors'

export default function CollapsibleSection({ title, subtitle, defaultOpen = false, children, extra, divider = false }) {
  const C = useC()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      {divider && <div className="h-px" style={{ backgroundColor: C.hoverStrong }} />}
      <div
        className="flex items-center justify-between cursor-pointer select-none py-4 -mx-5 px-5 sm:-mx-7 sm:px-7 rounded-xl transition-colors duration-150"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = C.hoverMed}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: C.warmText }}>{title}</p>
          {subtitle && <p className="text-sm" style={{ color: C.muted }}>{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {extra}
          <button type="button" className="p-1 rounded-lg bg-transparent border-none cursor-pointer" style={{ color: C.muted }}>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? '9999px' : '0px' }}>
        {children}
      </div>
    </div>
  )
}
