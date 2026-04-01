import { useState, useCallback, useEffect } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import api from './api.js'
import SummaryBar from './components/SummaryBar.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import BudgetSetup from './components/BudgetSetup.jsx'
import BudgetEdit from './components/BudgetEdit.jsx'

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [budgetsReady, setBudgetsReady] = useState(null) // null = loading
  const [page, setPage] = useState('home')

  useEffect(() => {
    api.get('/budgets').then(res => {
      setBudgetsReady(res.data.length > 0)
    })
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  if (budgetsReady === null) return null // loading

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
        <Toolbar sx={{ gap: 2 }}>
          <AccountBalanceWalletIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, color: 'text.primary', flexGrow: 0, mr: 3 }}
          >
            Budget Tracker
          </Typography>
          <Tabs
            value={page}
            onChange={(_, val) => setPage(val)}
            textColor="inherit"
            TabIndicatorProps={{ style: { backgroundColor: '#8fb996' } }}
          >
            <Tab
              label="Overview"
              value="home"
              sx={{ color: page === 'home' ? 'primary.main' : 'text.secondary' }}
            />
            <Tab
              label="Budget Goals"
              value="budgets"
              sx={{ color: page === 'budgets' ? 'primary.main' : 'text.secondary' }}
            />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          maxWidth: 1100,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: 3,
        }}
      >
        {page === 'home' ? (
          <>
            <SummaryBar refreshKey={refreshKey} />
            <ExpenseList refreshKey={refreshKey} onRefresh={refresh} />
          </>
        ) : (
          <BudgetEdit onSaved={refresh} />
        )}
      </Box>
    </Box>
  )
}
