import { useState, useCallback, useEffect } from 'react'
import { Home, BarChart2, PiggyBank, Landmark, Receipt, Sun, Moon, UserCircle } from 'lucide-react'
import { TallyLogo } from './components/TallyLogo.jsx'
import api from './api.js'
import { supabase } from './supabase.js'
import { ExpenseTypesProvider, useExpenseTypes } from './ExpenseTypesContext.jsx'
import { ColorsProvider, useC } from './colors'
import ExpenseList from './components/ExpenseList.jsx'
import BudgetSetup from './components/BudgetSetup.jsx'
import BudgetGoals from './components/BudgetGoals.jsx'
import SavingsPage from './components/SavingsPage.jsx'
import AnalysisPage from './components/AnalysisPage.jsx'
import DashboardPage from './components/DashboardPage.jsx'
import AuthPage from './components/AuthPage.jsx'
import AccountPage from './components/AccountPage.jsx'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

const NAV_ITEMS = [
  { value: 'home',         label: 'Overview',  Icon: Home },
  { value: 'analysis',     label: 'Analysis',  Icon: BarChart2 },
  { value: 'savings',      label: 'Savings',   Icon: PiggyBank },
  { value: 'budgets',      label: 'Budgets',   Icon: Landmark },
  { value: 'all-expenses', label: 'Expenses',  Icon: Receipt },
]

function AppContent({ mode, onToggleMode, onLogout, user }) {
  const C = useC()
  const { loading: typesLoading } = useExpenseTypes()
  const [refreshKey, setRefreshKey] = useState(0)
  const [budgetsReady, setBudgetsReady] = useState(null)
  const [page, setPage] = useState('home')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [outlierMonth, setOutlierMonth] = useState(null)
  const [initialExpenseType, setInitialExpenseType] = useState(null)
  const [initialExpenseId, setInitialExpenseId] = useState(null)
  const [initialExpenseMonth, setInitialExpenseMonth] = useState(null)

  const handleNavigate = useCallback((pg, opts = {}) => {
    setPage(pg)
    if (opts.outlierMonth !== undefined) setOutlierMonth(opts.outlierMonth)
  }, [])

  const handleShowInExpenses = useCallback((expense) => {
    setInitialExpenseType(expense.type)
    setInitialExpenseId(expense.id)
    setInitialExpenseMonth(expense.date.slice(0, 7))
    setPage('all-expenses')
  }, [])

  useEffect(() => {
    api.get('/budgets').then(res => {
      setBudgetsReady(res.data.length > 0)
    })
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  if (budgetsReady === null || typesLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 64, borderBottom: '1px solid rgba(128,128,128,0.15)' }} />
      <div style={{ flex: 1, padding: '24px 16px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        {[180, 120, 220, 160].map((h, i) => (
          <div key={i} style={{
            height: h, borderRadius: 16, marginBottom: 16,
            background: 'rgba(128,128,128,0.08)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </div>
    </div>
  )

  if (!budgetsReady) {
    return <BudgetSetup onComplete={refresh} />
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Desktop top nav */}
      <header
        className="hidden sm:flex items-center sticky top-0 z-50 px-6 gap-6"
        style={{
          height: 64,
          backgroundColor: C.nav,
          borderBottom: `1px solid ${C.borderMed}`,
          '--hover-tint': 'rgba(247,243,238,0.12)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center flex-shrink-0">
          <TallyLogo dark />
        </div>

        {/* Nav tabs */}
        <div className="flex gap-1 flex-1">
          {NAV_ITEMS.map(({ value, label }) => {
            const active = page === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPage(value)}
                className="px-4 py-1.5 rounded-full text-sm font-[inherit] border-none cursor-pointer transition-colors duration-150"
                style={{
                  fontWeight: active ? 700 : 500,
                  color: active ? C.navText : 'var(--text-on-nav-muted)',
                  backgroundColor: active ? 'rgba(247,243,238,0.15)' : 'transparent',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Theme toggle + account */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMode}
            className="p-1.5 rounded-lg border-none cursor-pointer transition-colors duration-150"
            style={{ color: 'var(--text-on-nav-muted)', backgroundColor: 'transparent' }}
          >
            {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setPage('account')}
            className="p-1.5 rounded-lg border-none cursor-pointer transition-colors duration-150"
            style={{ color: page === 'account' ? C.navText : 'var(--text-on-nav-muted)', backgroundColor: 'transparent' }}
            title="Account settings"
          >
            <UserCircle size={18} />
          </button>
        </div>
      </header>

      {/* Mobile top bar */}
      <div
        className="flex sm:hidden items-center justify-between px-4"
        style={{
          height: 52,
          backgroundColor: C.nav,
          borderBottom: `1px solid ${C.borderMed}`,
          '--hover-tint': 'rgba(247,243,238,0.12)',
        }}
      >
        <div className="flex items-center">
          <TallyLogo compact dark />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleMode}
            className="p-1.5 rounded-lg border-none cursor-pointer"
            style={{ color: 'var(--text-on-nav-muted)', backgroundColor: 'transparent' }}
          >
            {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setPage('account')}
            className="p-1.5 rounded-lg border-none cursor-pointer"
            style={{ color: page === 'account' ? C.navText : 'var(--text-on-nav-muted)', backgroundColor: 'transparent' }}
          >
            <UserCircle size={16} />
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="flex sm:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          height: 60,
          backgroundColor: C.nav,
          borderTop: `1px solid ${C.borderMed}`,
          '--hover-tint': 'rgba(247,243,238,0.12)',
        }}
      >
        {NAV_ITEMS.map(({ value, label, Icon }) => {
          const active = page === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => setPage(value)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 border-none cursor-pointer bg-transparent font-[inherit]"
              style={{ color: active ? C.navText : 'var(--text-on-nav-muted)' }}
            >
              <Icon size={20} />
              <span className="text-[0.65rem] font-semibold leading-none">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Page content */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 pb-[72px] sm:pb-6">
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
          <AnalysisPage outlierMonth={outlierMonth} onClearOutlierMonth={() => setOutlierMonth(null)} onShowInExpenses={handleShowInExpenses} />
        )}
        {page === 'savings' && <SavingsPage />}
        {page === 'budgets' && <BudgetGoals onSaved={refresh} />}
        {page === 'all-expenses' && (
          <ExpenseList
            refreshKey={refreshKey}
            onRefresh={refresh}
            initialType={initialExpenseType}
            initialHighlightId={initialExpenseId}
            initialMonth={initialExpenseMonth}
            onInitialTypeConsumed={() => { setInitialExpenseType(null); setInitialExpenseId(null); setInitialExpenseMonth(null) }}
          />
        )}
        {page === 'account' && <AccountPage user={user} onLogout={onLogout} />}
      </main>
    </div>
  )
}

function ThemedApp() {
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'light')
  const [user, setUser] = useState(undefined)
  const toggleMode = () => setMode(m => {
    const next = m === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', next)
    return next
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        api.get('/auth/me').catch(() => {})
        setUser({ id: session.user.id, email: session.user.email })
      } else {
        setUser(null)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') return
      if (session) {
        api.get('/auth/me').catch(() => {})
        setUser({ id: session.user.id, email: session.user.email })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = () => {
    supabase.auth.signOut()
  }

  if (user === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(74,55,40,0.15)', borderTopColor: '#3B6D11', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (user === null) return (
    <ColorsProvider mode={mode}>
      <AuthPage mode={mode} onToggleMode={toggleMode} />
    </ColorsProvider>
  )

  return (
    <ColorsProvider mode={mode}>
      <ExpenseTypesProvider>
        <AppContent mode={mode} onToggleMode={toggleMode} onLogout={handleLogout} user={user} />
      </ExpenseTypesProvider>
    </ColorsProvider>
  )
}

export default function App() {
  return <ThemedApp />
}
