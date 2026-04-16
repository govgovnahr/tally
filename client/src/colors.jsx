// ─── Raw palette ──────────────────────────────────────────────────────────────
// All hex values live here. Nothing else in the app should hard-code a hex.
import { createContext, useContext } from 'react'

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
    bg:            '#eef5ee',
    paper:         '#ffffff',
    elevated:      '#e6f0e6',
    text:          '#111827',
    textSecondary: '#64748b',
  },
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
    warmText:  palette.dark.text,
    dimText:   palette.grey,
    tickLight: palette.greyLight,
    muted:     palette.dark.textSecondary,

    // Category card tint helpers (append to hex color: `${color}${cardTintAlpha}`)
    cardTintAlpha:         '00',
    cardTintSelectedAlpha: '18',
    cardBorderAlpha:       '32',

    // Surfaces & borders
    surface:      palette.dark.paper,
    surfaceAlt:   palette.dark.elevated,
    subtleBg:     'rgba(228,232,240,0.03)',
    border:       'rgba(228,232,240,0.09)',
    borderSubtle: 'rgba(228,232,240,0.07)',
    borderLight:  'rgba(228,232,240,0.11)',
    borderMed:    'rgba(228,232,240,0.16)',
    borderStrong: 'rgba(228,232,240,0.26)',
    borderHover:  'rgba(228,232,240,0.32)',
    refLine:      'rgba(228,232,240,0.16)',
    gridLine:     'rgba(228,232,240,0.05)',
    hover:        'rgba(228,232,240,0.04)',
    hoverMed:     'rgba(228,232,240,0.06)',
    hoverStrong:  'rgba(228,232,240,0.09)',
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
    primaryTint:       'rgba(45,138,80,0.09)',
    menuSelected:      'rgba(45,138,80,0.08)',
    menuSelectedHover: 'rgba(45,138,80,0.13)',
    dropHoverBg:       'rgba(45,138,80,0.04)',

    // Text / labels
    warmText:  '#111827',
    dimText:   '#9ca3af',
    tickLight: '#6b7280',
    muted:     '#64748b',

    // Category card tint helpers (append to hex color: `${color}${cardTintAlpha}`)
    cardTintAlpha:         '0a',
    cardTintSelectedAlpha: '18',
    cardBorderAlpha:       '00',

    // Surfaces & borders
    surface:      '#ffffff',
    surfaceAlt:   palette.light.elevated,
    subtleBg:     'rgba(17,24,39,0.02)',
    border:       'rgba(17,24,39,0.09)',
    borderSubtle: 'rgba(17,24,39,0.07)',
    borderLight:  'rgba(17,24,39,0.11)',
    borderMed:    'rgba(17,24,39,0.15)',
    borderStrong: 'rgba(17,24,39,0.22)',
    borderHover:  'rgba(17,24,39,0.28)',
    refLine:      'rgba(17,24,39,0.14)',
    gridLine:     'rgba(17,24,39,0.05)',
    hover:        'rgba(17,24,39,0.04)',
    hoverMed:     'rgba(17,24,39,0.06)',
    hoverStrong:  'rgba(17,24,39,0.09)',
  }
}

// ─── React context ────────────────────────────────────────────────────────────

const ColorsContext = createContext(makeDarkC())

export function ColorsProvider({ mode, children }) {
  const value = mode === 'light' ? makeLightC() : makeDarkC()
  return <ColorsContext.Provider value={value}>{children}</ColorsContext.Provider>
}

export function useC() {
  return useContext(ColorsContext)
}

// Static export — dark defaults, used in non-component contexts (menuStyles, etc.)
export const C = makeDarkC()

// ─── Type color picker palette ────────────────────────────────────────────────

export const TYPE_PALETTE = [
  palette.orange, palette.blue, palette.lavender, palette.amber, palette.teal, palette.grey,
  '#ef9a9a', '#90caf9', '#a5d6a7', '#ffcc80', '#ce93d8', '#f48fb1',
  '#ff8a65', '#4db6ac', '#7986cb', '#aed581',
]
