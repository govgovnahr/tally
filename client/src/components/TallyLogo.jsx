// Coordinates map directly to logo.svg nav-compact variant.
// circle cx=500, cy=80 (light) / cy=280 (dark)
// mark x positions: 484.5 494.5 504.5 514.5  (g transform translate(0.5,1))
// diagonal: x 479.5→520.5,  y offsets +17→-17 from cy
// text: x=536, y=cy+10, fontSize=28
// To update: change the constants below to match logo.svg edits.

const CX = 500
const MARK_XS = [484.5, 494.5, 504.5, 514.5]
const MARK_Y_BELOW = 13   // cy + 13 = mark bottom  (93 light / 293 dark)
const MARK_Y_ABOVE = 11   // cy - 11 = mark top     (69 light / 269 dark)
const DIAG_Y_BELOW = 17   // cy + 17 = diagonal bottom
const DIAG_Y_ABOVE = 17   // cy - 17 = diagonal top
const DIAG_X1 = 479.5
const DIAG_X2 = 520.5
const TEXT_X = 536
const TEXT_Y_OFFSET = 10  // cy + 10 = text baseline

const LIGHT = { circle: '#4A3728', mark: '#F7F3EE', diag: '#97C459',  text: '#4A3728' }
const DARK  = { circle: '#3B6D11', mark: '#EAF3DE', diag: '#C0DD97', text: '#F7F3EE' }

export function TallyLogo({ compact = false, dark = false }) {
  const cy = dark ? 280 : 80
  const col = dark ? DARK : LIGHT

  const y1 = cy + MARK_Y_BELOW
  const y2 = cy - MARK_Y_ABOVE
  const dy1 = cy + DIAG_Y_BELOW
  const dy2 = cy - DIAG_Y_ABOVE
  const vbY = cy - 24

  const marks = (
    <>
      {MARK_XS.map(x => (
        <line key={x} x1={x} y1={y1} x2={x} y2={y2}
          stroke={col.mark} strokeWidth="3" strokeLinecap="round" />
      ))}
      <line x1={DIAG_X1} y1={dy1} x2={DIAG_X2} y2={dy2}
        stroke={col.diag} strokeWidth="2.5" strokeLinecap="round" />
    </>
  )

  if (compact) {
    return (
      <svg width="32" height="32" viewBox={`476 ${vbY} 48 48`} aria-label="Tally"
        style={{ display: 'block', userSelect: 'none' }} draggable="false">
        <circle cx={CX} cy={cy} r="24" fill={col.circle} />
        {marks}
      </svg>
    )
  }
  return (
    <svg width="112" height="34" viewBox={`476 ${vbY} 174 48`} aria-label="Tally"
      style={{ display: 'block', userSelect: 'none' }} draggable="false">
      <circle cx={CX} cy={cy} r="24" fill={col.circle} />
      {marks}
      <text x={TEXT_X} y={cy + TEXT_Y_OFFSET}
        fontFamily="Georgia, serif" fontSize="28" fontWeight="500" fill={col.text}>
        Tally
      </text>
    </svg>
  )
}
