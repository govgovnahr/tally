import { useState, useCallback, useEffect } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import ButtonBase from '@mui/material/ButtonBase'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import HomeIcon from '@mui/icons-material/Home'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import SavingsIcon from '@mui/icons-material/Savings'
import BarChartIcon from '@mui/icons-material/BarChart'
import api from './api.js'
import { ExpenseTypesProvider, useExpenseTypes } from './ExpenseTypesContext.jsx'
import { ColorsProvider, useC } from './colors'
import { createAppTheme } from './theme.js'
import ExpenseList from './components/ExpenseList.jsx'
import BudgetSetup from './components/BudgetSetup.jsx'
import BudgetGoals from './components/BudgetGoals.jsx'
import SavingsPage from './components/SavingsPage.jsx'
import AnalysisPage from './components/AnalysisPage.jsx'
import DashboardPage from './components/DashboardPage.jsx'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

const NAV_ITEMS = [
  { value: 'home',         label: 'Overview',    icon: <HomeIcon /> },
  { value: 'analysis',     label: 'Analysis',    icon: <BarChartIcon /> },
  { value: 'savings',      label: 'Savings',     icon: <SavingsIcon /> },
  { value: 'budgets',      label: 'Budgets',     icon: <AccountBalanceIcon /> },
  { value: 'all-expenses', label: 'Expenses',    icon: <ReceiptLongIcon /> },

]

function AppContent({ mode, onToggleMode }) {
  const C = useC()
  const { loading: typesLoading } = useExpenseTypes()
  const [refreshKey, setRefreshKey] = useState(0)
  const [budgetsReady, setBudgetsReady] = useState(null)
  const [page, setPage] = useState('home')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [outlierMonth, setOutlierMonth] = useState(null)

  const handleNavigate = useCallback((pg, opts = {}) => {
    setPage(pg)
    if (opts.outlierMonth !== undefined) setOutlierMonth(opts.outlierMonth)
  }, [])

  useEffect(() => {
    api.get('/budgets').then(res => {
      setBudgetsReady(res.data.length > 0)
    })
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  if (budgetsReady === null || typesLoading) return null

  if (!budgetsReady) {
    return <BudgetSetup onComplete={refresh} />
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ── Desktop top nav ─────────────────────────────── */}
      <Box
        component="header"
        sx={{
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          bgcolor: C.surface,
          borderBottom: `1px solid ${C.border}`,
          px: 3,
          height: 64,
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          gap: 3,
        }}
      >
        {/* Logo */}
        <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '10px',
              bgcolor: C.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SavingsIcon sx={{ fontSize: 16, color: '#fff' }} />
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1rem',
              color: 'text.primary',
              letterSpacing: '-0.02em',
            }}
          >
            Budget
          </Typography>
        </Stack>

        {/* Nav tabs */}
        <Stack direction="row" gap={0.5} sx={{ flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = page === item.value
            return (
              <ButtonBase
                key={item.value}
                onClick={() => setPage(item.value)}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: '100px',
                  fontSize: '0.875rem',
                  fontWeight: active ? 700 : 500,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  color: active ? C.primary : 'text.secondary',
                  bgcolor: active ? C.primaryTint : 'transparent',
                  transition: 'all 0.15s',
                  '&:hover': {
                    bgcolor: active ? C.primaryTint : C.hover,
                    color: active ? C.primary : 'text.primary',
                  },
                }}
              >
                {item.label}
              </ButtonBase>
            )
          })}
        </Stack>

        {/* Mode toggle */}
        <IconButton
          size="small"
          onClick={onToggleMode}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: C.primary, bgcolor: C.primaryTint },
            borderRadius: '8px',
          }}
        >
          {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* ── Mobile top bar ───────────────────────────────── */}
      <Box
        sx={{
          display: { xs: 'flex', sm: 'none' },
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: C.surface,
          borderBottom: `1px solid ${C.border}`,
          px: 2,
          height: 52,
        }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '9px',
              bgcolor: C.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SavingsIcon sx={{ fontSize: 14, color: '#fff' }} />
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: 'text.primary', letterSpacing: '-0.02em' }}>
            Budget
          </Typography>
        </Stack>
        <IconButton
          size="small"
          onClick={onToggleMode}
          sx={{ color: 'text.secondary', borderRadius: '8px' }}
        >
          {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* ── Mobile bottom navigation ──────────────────────── */}
      <BottomNavigation
        value={page}
        onChange={(_, val) => setPage(val)}
        sx={{
          display: { xs: 'flex', sm: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          bgcolor: C.surface,
          borderTop: `1px solid ${C.border}`,
          height: 60,
          '& .MuiBottomNavigationAction-root': {
            color: 'text.disabled',
            minWidth: 0,
            px: 0.5,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          },
          '& .Mui-selected': { color: C.primary },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.65rem !important',
            fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          },
          '& .MuiBottomNavigationAction-label.Mui-selected': {
            fontSize: '0.65rem !important',
          },
        }}
      >
        {NAV_ITEMS.map(item => (
          <BottomNavigationAction
            key={item.value}
            label={item.label}
            value={item.value}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>

      {/* ── Page content ─────────────────────────────────── */}
      <Box
        component="main"
        sx={{
          maxWidth: 1100,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: { xs: 2.5, sm: 3 },
          pb: { xs: 10, sm: 3 },
        }}
      >
        {page === 'home' && (
          <DashboardPage
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            refreshKey={refreshKey}
            onRefresh={refresh}
            onNavigate={handleNavigate}
          />
        )}
        {page === 'analysis' && (
          <AnalysisPage outlierMonth={outlierMonth} onClearOutlierMonth={() => setOutlierMonth(null)} />
        )}
        {page === 'savings' && (
          <SavingsPage />
        )}
        {page === 'budgets' && (
          <BudgetGoals onSaved={refresh} />
        )}
        {page === 'all-expenses' && (
          <ExpenseList refreshKey={refreshKey} onRefresh={refresh} />
        )}
      </Box>
    </Box>
  )
}

function ThemedApp() {
  const [mode, setMode] = useState('dark')
  const theme = createAppTheme(mode)
  const toggleMode = () => setMode(m => m === 'dark' ? 'light' : 'dark')

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ColorsProvider mode={mode}>
        <ExpenseTypesProvider>
          <AppContent mode={mode} onToggleMode={toggleMode} />
        </ExpenseTypesProvider>
      </ColorsProvider>
    </ThemeProvider>
  )
}

export default function App() {
  return <ThemedApp />
}
