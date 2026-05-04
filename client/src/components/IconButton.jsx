import { useC } from '../colors'

// className controls padding (default p-1.5); pass className="p-1" for tighter buttons.
export default function IconButton({ title, onClick, hoverColor, children, className = 'p-1.5' }) {
  const C = useC()
  const hc = hoverColor ?? C.primary
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`${className} rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150`}
      style={{ color: C.muted }}
      onMouseEnter={e => e.currentTarget.style.color = hc}
      onMouseLeave={e => e.currentTarget.style.color = C.muted}
    >
      {children}
    </button>
  )
}
