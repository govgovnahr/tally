export default function ColorSwatch({ color, selected, onClick, size = 24, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-full transition-opacity hover:opacity-85 ${className}`}
      style={{
        width: size, height: size, backgroundColor: color, flexShrink: 0,
        border: selected ? '2px solid white' : '2px solid transparent',
        outline: selected ? `2px solid ${color}` : 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}
