// ─── Raw palette ──────────────────────────────────────────────────────────────
// All hex values live here. Nothing else in the app should hard-code a hex.
import { createContext, useContext, useEffect } from 'react'

export const palette = {
  // Brand accent colors (shared across modes)
  green:     '#52c97a',
  red:       '#e07c7c',
  amber:     '#f0c040',
  teal:      '#4db6ac',
  blue:      '#64b5f6',
  lavender:  '#b39ddb',
  orange:    '#e8a87c',
  grey:      '#9e9e9e',
  greyLight: '#bdbdbd',
  peach:     '#f4a261',
  purple:    '#9575cd',

  // Dark mode surfaces
  dark: {
    bg:            '#0e0e10',
    paper:         '#161618',
    elevated:      '#1e1e22',
    text:          '#e4e8f0',
    textSecondary: 'rgba(228,232,240,0.5)',
  },

  // Light mode surfaces
  light: {
    bg:            '#c0d8c0',
    paper:         '#dae7da',
    elevated:      '#d0e0d0',
    text:          '#111827',
    textSecondary: '#64748b',
  },
}

// ─── Color adaptation utilities ───────────────────────────────────────────────

function hue2rgb(p, q, t) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1/6) return p + (q - p) * 6 * t
  if (t < 1/2) return q
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
  return p
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return '#' + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('')
}

// Darkens light colors for legibility on light backgrounds; identity on dark mode
function darkenForLight(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return hex
  const [h, s, l] = hexToHsl(hex)
  if (l <= 52) return hex
  return hslToHex(h, Math.min(s + 8, 85), 42)
}

// ─── Semantic token factories ─────────────────────────────────────────────────

function makeDarkC() {
  return {
    // Chart / data
    income:      palette.teal,
    spent:       palette.blue,
    netPositive: palette.green,
    netNegative: palette.red,
    netLine:     palette.orange,

    // Status
    onTrack:    palette.green,
    nearGoal:   palette.teal,
    atRisk:     palette.amber,
    overBudget: palette.red,
    noBudget:   'rgba(228,232,240,0.12)',

    // Trend direction (lower spend = good)
    trendUp:   palette.red,
    trendDown: palette.green,

    // Primary UI
    primary:             palette.green,
    primaryHover:        '#3db864',
    incomeButtonBg:      palette.teal,
    incomeButtonHover:   '#3da099',
    incomeButtonHoverBg: 'rgba(77,182,172,0.08)',

    // Primary color tints
    primaryTint:       'rgba(82,201,122,0.10)',
    menuSelected:      'rgba(82,201,122,0.08)',
    menuSelectedHover: 'rgba(82,201,122,0.14)',
    dropHoverBg:       'rgba(82,201,122,0.04)',

    // Text / labels
    warmText:  '#e0ece0',
    dimText:   '#7a967a',
    tickLight: '#8aaa8a',
    muted:     'rgba(200,228,200,0.55)',

    // Category card tint helpers (append to hex color: `${color}${cardTintAlpha}`)
    cardTintAlpha:         '00',
    cardTintSelectedAlpha: '18',
    cardBorderAlpha:       '32',

    // Surfaces & borders
    surface:      '#141414',
    surfaceAlt:   '#1c1c1c',
    surfacePopup: '#141414',
    subtleBg:     'rgba(82,201,122,0.04)',
    border:       'rgba(82,201,122,0.12)',
    borderSubtle: 'rgba(82,201,122,0.09)',
    borderLight:  'rgba(82,201,122,0.14)',
    borderMed:    'rgba(82,201,122,0.18)',
    borderStrong: 'rgba(82,201,122,0.26)',
    borderHover:  'rgba(82,201,122,0.32)',
    refLine:      'rgba(82,201,122,0.15)',
    gridLine:     'rgba(82,201,122,0.06)',
    hover:        'rgba(82,201,122,0.06)',
    hoverMed:     'rgba(82,201,122,0.09)',
    hoverStrong:  'rgba(82,201,122,0.13)',
    adaptColor:   hex => hex,
  }
}

function makeLightC() {
  return {
    // Chart / data — darker variants for legibility on white
    income:      '#0d9488',
    spent:       '#3b82f6',
    netPositive: '#16a34a',
    netNegative: '#dc2626',
    netLine:     '#ea580c',

    // Status
    onTrack:    '#16a34a',
    nearGoal:   '#0d9488',
    atRisk:     '#ca8a04',
    overBudget: '#dc2626',
    noBudget:   'rgba(17,24,39,0.08)',

    // Trend direction
    trendUp:   '#dc2626',
    trendDown: '#16a34a',

    // Primary UI
    primary:             '#2d8a50',
    primaryHover:        '#1e7a40',
    incomeButtonBg:      '#0d9488',
    incomeButtonHover:   '#0f766e',
    incomeButtonHoverBg: 'rgba(13,148,136,0.08)',

    // Primary color tints
    primaryTint:       'rgba(45,138,80,0.14)',
    menuSelected:      'rgba(45,138,80,0.12)',
    menuSelectedHover: 'rgba(45,138,80,0.19)',
    dropHoverBg:       'rgba(45,138,80,0.04)',

    // Text / labels
    warmText:  '#111827',
    dimText:   '#9ca3af',
    tickLight: '#6b7280',
    muted:     '#64748b',

    // Category card tint helpers (append to hex color: `${color}${cardTintAlpha}`)
    cardTintAlpha:         '0a',
    cardTintSelectedAlpha: '18',
    cardBorderAlpha:       '28',

    // Surfaces & borders
    surface:      '#ffffff',
    surfaceAlt:   '#f4faf4',
    surfacePopup: '#ffffff',
    subtleBg:     'rgba(45,138,80,0.06)',
    border:       'rgba(0,0,0,0.10)',
    borderSubtle: 'rgba(0,0,0,0.07)',
    borderLight:  'rgba(0,0,0,0.10)',
    borderMed:    'rgba(0,0,0,0.14)',
    borderStrong: 'rgba(0,0,0,0.18)',
    borderHover:  'rgba(0,0,0,0.24)',
    refLine:      'rgba(17,24,39,0.14)',
    gridLine:     'rgba(17,24,39,0.05)',
    hover:        'rgba(45,138,80,0.08)',
    hoverMed:     'rgba(45,138,80,0.12)',
    hoverStrong:  'rgba(45,138,80,0.16)',
    adaptColor:   darkenForLight,
  }
}

// ─── React context ────────────────────────────────────────────────────────────

const ColorsContext = createContext(makeDarkC())

export function ColorsProvider({ mode, children }) {
  const value = { ...(mode === 'light' ? makeLightC() : makeDarkC()), mode }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  return <ColorsContext.Provider value={value}>{children}</ColorsContext.Provider>
}

export function useC() {
  return useContext(ColorsContext)
}

// Static export — dark defaults, used in non-component contexts
export const C = makeDarkC()

// ─── Type color picker palette ────────────────────────────────────────────────

export const TYPE_PALETTE = [
  palette.orange, palette.blue, palette.lavender, palette.amber, palette.teal, palette.grey,
  '#ef9a9a', '#90caf9', '#a5d6a7', '#ffcc80', '#ce93d8', '#f48fb1',
  '#ff8a65', '#4db6ac', '#7986cb', '#aed581',
]
