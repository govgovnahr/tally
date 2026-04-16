import { createTheme } from '@mui/material/styles'
import { palette } from './colors'

export function createAppTheme(mode = 'dark') {
  const isDark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      background: {
        default: isDark ? palette.dark.bg    : palette.light.bg,
        paper:   isDark ? palette.dark.paper : palette.light.paper,
      },
      primary: {
        main: isDark ? '#52c97a' : '#2d8a50',
      },
      error: {
        main: palette.red,
      },
      text: {
        primary:   isDark ? palette.dark.text          : palette.light.text,
        secondary: isDark ? palette.dark.textSecondary : palette.light.textSecondary,
      },
    },
    typography: {
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.015em' },
      h6: { fontWeight: 700, letterSpacing: '-0.01em' },
      body1: { fontWeight: 400 },
      body2: { fontWeight: 400, fontSize: '0.875rem' },
      caption: { fontWeight: 400, fontSize: '0.78rem' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 100,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            ...(theme.palette.mode === 'light'
              ? { boxShadow: '0px 1px 3px rgba(0,0,0,0.07), 0px 4px 16px rgba(0,0,0,0.05)' }
              : { border: '1px solid rgba(228,232,240,0.07)' }
            ),
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: 'none',
            borderRadius: 20,
            ...(theme.palette.mode === 'light'
              ? { boxShadow: '0px 1px 3px rgba(0,0,0,0.07), 0px 4px 16px rgba(0,0,0,0.05)' }
              : { border: '1px solid rgba(228,232,240,0.07)' }
            ),
          }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            ...(theme.palette.mode === 'dark'
              ? { border: '1px solid rgba(228,232,240,0.07)' }
              : { boxShadow: '0px 8px 40px rgba(0,0,0,0.14)' }
            ),
          }),
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 600,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '0.875rem',
            minHeight: 52,
          },
        },
      },
    },
  })
}

// Default export — dark theme, for backward compat
export default createAppTheme('dark')
