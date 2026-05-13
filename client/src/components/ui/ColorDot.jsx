const SIZES = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5' }

export default function ColorDot({ color, size = 'sm' }) {
  return (
    <div
      className={`${SIZES[size]} rounded-full flex-shrink-0`}
      style={{ backgroundColor: color }}
    />
  )
}
