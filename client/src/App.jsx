import { useState, useCallback, useEffect } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import HomeIcon from '@mui/icons-material/Home'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import SavingsIcon from '@mui/icons-material/Savings'
import BarChartIcon from '@mui/icons-material/BarChart'
import api from './api.js'
import { ExpenseTypesProvider, useExpenseTypes } from './ExpenseTypesContext.jsx'
import SummaryBar from './components/SummaryBar.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import MonthlyTrendsChart from './components/MonthlyTrendsChart.jsx'
import BudgetSetup from './components/BudgetSetup.jsx'
import BudgetGoals from './components/BudgetGoals.jsx'
import SavingsPage from './components/SavingsPage.jsx'
import MonthSelector from './components/MonthSelector.jsx'
import AnalysisPage from './components/AnalysisPage.jsx'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function AppContent() {
  const { loading: typesLoading } = useExpenseTypes()
  const [refreshKey, setRefreshKey] = useState(0)
  const [budgetsReady, setBudgetsReady] = useState(null) // null = loading
  const [page, setPage] = useState('home')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [activeType, setActiveType] = useState('All')
  const [activeMacro, setActiveMacro] = useState(null)

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
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: '#22252e',
          borderBottom: '1px solid rgba(240, 234, 214, 0.12)',
        }}
      >
        <Toolbar sx={{ gap: 2, px: { xs: 1, sm: 2 } }}>
          <AccountBalanceWalletIcon sx={{ color: 'primary.main', fontSize: 28, flexShrink: 0 }} />
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, color: 'text.primary', flexGrow: 0, mr: { xs: 0, sm: 2 } }}
          >
            Budget Tracker
          </Typography>
          <Tabs
            value={page}
            onChange={(_, val) => setPage(val)}
            textColor="inherit"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            TabIndicatorProps={{ style: { backgroundColor: '#8fb996' } }}
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          >
            <Tab label="Overview" value="home" sx={{ color: page === 'home' ? 'primary.main' : 'text.secondary' }} />
            <Tab label="All Expenses" value="all-expenses" sx={{ color: page === 'all-expenses' ? 'primary.main' : 'text.secondary' }} />
            <Tab label="Budget Goals" value="budgets" sx={{ color: page === 'budgets' ? 'primary.main' : 'text.secondary' }} />
            <Tab label="Savings" value="savings" sx={{ color: page === 'savings' ? 'primary.main' : 'text.secondary' }} />
            <Tab label="Analysis" value="analysis" sx={{ color: page === 'analysis' ? 'primary.main' : 'text.secondary' }} />
          </Tabs>
        </Toolbar>
      </AppBar>
      {/* Mobile bottom navigation */}
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
          bgcolor: '#22252e',
          borderTop: '1px solid rgba(240,234,214,0.12)',
          '& .MuiBottomNavigationAction-root': { color: 'text.disabled', minWidth: 0, px: 0.5 },
          '& .Mui-selected': { color: 'primary.main' },
          '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem' },
        }}
      >
        <BottomNavigationAction label="Home" value="home" icon={<HomeIcon />} />
        <BottomNavigationAction label="Expenses" value="all-expenses" icon={<ReceiptLongIcon />} />
        <BottomNavigationAction label="Budgets" value="budgets" icon={<AccountBalanceIcon />} />
        <BottomNavigationAction label="Savings" value="savings" icon={<SavingsIcon />} />
        <BottomNavigationAction label="Analysis" value="analysis" icon={<BarChartIcon />} />
      </BottomNavigation>

      <Box
        component="main"
        sx={{
          maxWidth: 1100,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: 3,
          pb: { xs: 10, sm: 3 },
        }}
      >
        {page === 'home' && (
          <>
            <MonthSelector
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              refreshKey={refreshKey}
            />
            <SummaryBar
              refreshKey={refreshKey}
              selectedMonth={selectedMonth}
              activeType={activeType}
              onTypeChange={t => { setActiveType(t); setActiveMacro(null) }}
              activeMacro={activeMacro}
              onMacroChange={m => { setActiveMacro(m); setActiveType('All') }}
            />
            <MonthlyTrendsChart
              refreshKey={refreshKey}
              selectedMonth={selectedMonth}
              activeType={activeType}
              onTypeChange={t => { setActiveType(t); setActiveMacro(null) }}
              activeMacro={activeMacro}
              onMacroChange={m => { setActiveMacro(m); setActiveType('All') }}
            />
            <ExpenseList
              refreshKey={refreshKey}
              onRefresh={refresh}
              month={selectedMonth}
              activeType={activeType}
              onTypeChange={t => { setActiveType(t); setActiveMacro(null) }}
              activeMacro={activeMacro}
              onMacroChange={m => { setActiveMacro(m); setActiveType('All') }}
            />
          </>
        )}
        {page === 'all-expenses' && (
          <ExpenseList refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {page === 'budgets' && (
          <BudgetGoals onSaved={refresh} />
        )}
        {page === 'savings' && (
          <SavingsPage />
        )}
        {page === 'analysis' && (
          <AnalysisPage />
        )}
      </Box>
    </Box>
  )
}

export default function App() {
  return (
    <ExpenseTypesProvider>
      <AppContent />
    </ExpenseTypesProvider>
  )
}
