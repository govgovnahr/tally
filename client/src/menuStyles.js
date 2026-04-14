// Shared dropdown styling — applied to all month (and other) Select/Menu components

export const DROPDOWN_PAPER_SX = {
  bgcolor: '#22252e',
  border: '1px solid rgba(240,234,214,0.12)',
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
  '&.Mui-selected': { bgcolor: 'rgba(143,185,150,0.08)', color: 'primary.main', fontWeight: 600 },
  '&.Mui-selected:hover': { bgcolor: 'rgba(143,185,150,0.12)' },
  '&:hover': { bgcolor: 'rgba(240,234,214,0.04)' },
}
