// ─── Raw palette ──────────────────────────────────────────────────────────────
// All hex values live here. Nothing else in the app should hard-code a hex.
import { createContext, useContext, useEffect } from 'react'

export const palette = {
  // Tally greens
  green:     '#639922',   // fern
  red:       '#C4604A',   // terracotta mid
  amber:     '#E8A838',   // amber mid
  teal:      '#8BAF5A',   // sage
  blue:      '#7A5C48',   // clay (used as "spent" neutral)
  lavender:  '#A0722A',   // amber dark
  orange:    '#C4604A',   // terracotta mid
  grey:      '#C4AFA6',   // sand
  greyLight: '#D3C4B0',   // linen
  peach:     '#FAD5CC',   // terracotta light
  purple:    '#4A3728',   // walnut

  // Dark mode surfaces
  dark: {
    bg:            '#0F0F0F',
    paper:         '#161616',
    elevated:      '#1E1E1E',
    text:          '#F0EBE3',
    textSecondary: 'rgba(240,235,227,0.5)',
  },

  // Light mode surfaces
  light: {
    bg:            '#EDE8DF',
    paper:         '#F7F3EE',
    elevated:      '#EDE8DF',
    text:          '#2A1F17',
    textSecondary: '#7A5C48',
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
    income:      '#97C459',   // sprout — income on dark bg
    spent:       '#8BAF5A',   // sage
    netPositive: '#97C459',
    netNegative: '#E08070',   // terracotta light

    // Status
    onTrack:    '#97C459',
    nearGoal:   '#C0DD97',
    atRisk:     '#E8A838',    // amber mid
    overBudget: '#E08070',    // terracotta light
    noBudget:   'rgba(196,175,166,0.12)',

    // Trend direction (lower spend = good)
    trendUp:   '#E08070',
    trendDown: '#97C459',

    // Primary UI
    primary:             '#639922',   // fern
    primaryHover:        '#8BAF5A',   // sage
    incomeButtonBg:      '#639922',
    incomeButtonHover:   '#8BAF5A',
    incomeButtonHoverBg: 'rgba(99,153,34,0.08)',

    // Primary color tints
    primaryTint:       'rgba(99,153,34,0.10)',
    menuSelected:      'rgba(99,153,34,0.08)',
    menuSelectedHover: 'rgba(99,153,34,0.14)',
    dropHoverBg:       'rgba(99,153,34,0.04)',

    // Text / labels
    warmText:  '#F7F3EE',
    dimText:   'rgba(240,235,227,0.35)',
    tickLight: '#8BAF5A',
    muted:     '#C4AFA6',

    // Category card tint helpers
    cardTintAlpha:         '00',
    cardTintSelectedAlpha: '18',
    cardBorderAlpha:       '32',

    // Surfaces & borders
    surface:      '#161616',
    surfaceAlt:   '#1E1E1E',
    surfacePopup: '#1E1E1E',
    subtleBg:     'rgba(99,153,34,0.04)',
    border:       'rgba(255,255,255,0.07)',
    borderSubtle: 'rgba(255,255,255,0.04)',
    borderLight:  '#2A2A2A',
    borderMed:    '#2A2A2A',
    borderStrong: '#383838',
    borderHover:  '#4A4A4A',
    refLine:      'rgba(99,153,34,0.15)',
    gridLine:     'rgba(99,153,34,0.06)',
    hover:        'rgba(255,255,255,0.04)',
    hoverMed:     'rgba(255,255,255,0.07)',
    hoverStrong:  'rgba(255,255,255,0.11)',
    adaptColor:   hex => hex,

    // Nav
    nav:     '#0A0A0A',
    navText: '#F0EBE3',
  }
}

function makeLightC() {
  return {
    // Chart / data
    income:      '#3B6D11',   // moss
    spent:       '#7A5C48',   // clay
    netPositive: '#3B6D11',
    netNegative: '#8B3A2A',   // terracotta dark

    // Status
    onTrack:    '#3B6D11',
    nearGoal:   '#639922',    // fern
    atRisk:     '#A0722A',    // amber dark
    overBudget: '#8B3A2A',    // terracotta dark
    noBudget:   'rgba(74,55,40,0.08)',

    // Trend direction
    trendUp:   '#8B3A2A',
    trendDown: '#3B6D11',

    // Primary UI
    primary:             '#3B6D11',
    primaryHover:        '#2D5016',
    incomeButtonBg:      '#3B6D11',
    incomeButtonHover:   '#2D5016',
    incomeButtonHoverBg: 'rgba(59,109,17,0.08)',

    // Primary color tints
    primaryTint:       'rgba(59,109,17,0.09)',
    menuSelected:      'rgba(59,109,17,0.08)',
    menuSelectedHover: 'rgba(59,109,17,0.14)',
    dropHoverBg:       'rgba(59,109,17,0.04)',

    // Text / labels
    warmText:  '#2A1F17',
    dimText:   '#C4AFA6',
    tickLight: '#7A5C48',
    muted:     '#7A5C48',

    // Category card tint helpers
    cardTintAlpha:         '0a',
    cardTintSelectedAlpha: '18',
    cardBorderAlpha:       '28',

    // Surfaces & borders
    surface:      '#F7F3EE',
    surfaceAlt:   '#EDE8DF',
    surfacePopup: '#F7F3EE',
    subtleBg:     'rgba(59,109,17,0.06)',
    border:       'rgba(211,196,176,0.8)',
    borderSubtle: 'rgba(211,196,176,0.5)',
    borderLight:  'rgba(211,196,176,0.9)',
    borderMed:    '#D3C4B0',
    borderStrong: '#C4AFA6',
    borderHover:  '#7A5C48',
    refLine:      'rgba(74,55,40,0.14)',
    gridLine:     'rgba(74,55,40,0.05)',
    hover:        'rgba(59,109,17,0.05)',
    hoverMed:     'rgba(59,109,17,0.08)',
    hoverStrong:  'rgba(59,109,17,0.12)',
    adaptColor:   darkenForLight,

    // Nav
    nav:     '#4A3728',
    navText: '#F7F3EE',
  }
}

// ─── React context ────────────────────────────────────────────────────────────

const ColorsContext = createContext(makeDarkC())

export function ColorsProvider({ mode, children }) {
  const value = { ...(mode === 'light' ? makeLightC() : makeDarkC()), mode }

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark')
    document.documentElement.setAttribute('data-theme', mode)
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
  '#3B6D11', // moss
  '#639922', // fern
  '#8BAF5A', // sage
  '#C0DD97', // sprout
  '#7A5C48', // clay
  '#A0722A', // amber dark
  '#8B3A2A', // terracotta dark
  '#4A3728', // walnut
  '#C4AFA6', // sand
  '#E8A838', // amber mid
  '#C4604A', // terracotta mid
  '#97C459', // light sage
  '#2D5016', // forest
  '#FAD5CC', // terracotta light
  '#D3C4B0', // linen
  '#5C4535', // clay dark
]
