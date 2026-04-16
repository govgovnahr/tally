// Shared dropdown styling — returned from useMenuStyles() hook for mode-awareness
import { useC } from './colors'

export function useMenuStyles() {
  const C = useC()
  return {
    DROPDOWN_PAPER_SX: {
      bgcolor: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 2,
      maxHeight: 360,
      boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
    },
    DROPDOWN_MENU_PROPS: {
      slotProps: {
        paper: {
          sx: {
            bgcolor: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 2,
            maxHeight: 360,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          },
        },
      },
    },
    DROPDOWN_ITEM_SX: {
      fontSize: '0.875rem',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: 'text.primary',
      minHeight: 36,
      '&.Mui-selected': { bgcolor: C.menuSelected, color: C.primary, fontWeight: 700 },
      '&.Mui-selected:hover': { bgcolor: C.menuSelectedHover },
      '&:hover': { bgcolor: C.hover },
    },
  }
}

// Legacy static exports — dark mode defaults for any non-hook usage
import { C } from './colors'
export const DROPDOWN_PAPER_SX = {
  bgcolor: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 1.5,
  maxHeight: 360,
}
export const DROPDOWN_MENU_PROPS = {
  slotProps: {
    paper: { sx: DROPDOWN_PAPER_SX },
  },
}
export const DROPDOWN_ITEM_SX = {
  fontSize: '0.875rem',
  color: 'text.primary',
  minHeight: 36,
  '&.Mui-selected': { bgcolor: C.menuSelected, color: C.primary, fontWeight: 600 },
  '&.Mui-selected:hover': { bgcolor: C.menuSelectedHover },
  '&:hover': { bgcolor: C.hover },
}
