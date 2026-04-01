import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#1a1c22',
      paper: '#22252e',
    },
    primary: {
      main: '#8fb996',
    },
    error: {
      main: '#e07c7c',
    },
    text: {
      primary: '#f0ead6',
      secondary: 'rgba(240, 234, 214, 0.55)',
    },
    card: {
      main: '#2c2f3a',
    },
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
})

export default theme
