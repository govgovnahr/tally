import { useState, useCallback, useEffect } from 'react'
import { Home, BarChart2, PiggyBank, Landmark, Receipt, Sun, Moon } from 'lucide-react'
import api from './api.js'
import { ExpenseTypesProvider, useExpenseTypes } from './ExpenseTypesContext.jsx'
import { ColorsProvider, useC } from './colors'
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
  { value: 'home',         label: 'Overview',  Icon: Home },
  { value: 'analysis',     label: 'Analysis',  Icon: BarChart2 },
  { value: 'savings',      label: 'Savings',   Icon: PiggyBank },
  { value: 'budgets',      label: 'Budgets',   Icon: Landmark },
  { value: 'all-expenses', label: 'Expenses',  Icon: Receipt },
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
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      {/* Blobs in their own stacking context so filter doesn't bleed into content */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', isolation: 'isolate' }} aria-hidden="true">
        <div className="glass-blob glass-blob-1" />
        <div className="glass-blob glass-blob-2" />
        <div className="glass-blob glass-blob-3" />
      </div>

      {/* Desktop top nav */}
      <header
        className="hidden sm:flex items-center sticky top-0 z-50 px-6 gap-6"
        style={{
          height: 64,
          backgroundColor: mode === 'dark' ? 'rgba(14,14,22,0.62)' : 'rgba(255,255,255,0.58)',
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center"
            style={{ backgroundColor: C.primary }}
          >
            <PiggyBank size={16} color="#fff" />
          </div>
          <span className="font-extrabold text-base tracking-tight" style={{ color: C.warmText }}>
            Budget
          </span>
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
                  color: active ? C.primary : C.muted,
                  backgroundColor: active ? C.primaryTint : 'transparent',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={onToggleMode}
          className="p-1.5 rounded-lg border-none cursor-pointer transition-colors duration-150"
          style={{ color: C.muted, backgroundColor: 'transparent' }}
        >
          {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Mobile top bar */}
      <div
        className="flex sm:hidden items-center justify-between px-4 backdrop-blur-xl"
        style={{
          height: 52,
          backgroundColor: C.surface,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center"
            style={{ backgroundColor: C.primary }}
          >
            <PiggyBank size={14} color="#fff" />
          </div>
          <span className="font-extrabold text-[0.9rem] tracking-tight" style={{ color: C.warmText }}>
            Budget
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleMode}
          className="p-1.5 rounded-lg border-none cursor-pointer"
          style={{ color: C.muted, backgroundColor: 'transparent' }}
        >
          {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="flex sm:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          height: 60,
          backgroundColor: mode === 'dark' ? 'rgba(14,14,22,0.62)' : 'rgba(255,255,255,0.58)',
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          borderTop: `1px solid ${C.border}`,
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
              style={{ color: active ? C.primary : C.dimText }}
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
          <AnalysisPage outlierMonth={outlierMonth} onClearOutlierMonth={() => setOutlierMonth(null)} />
        )}
        {page === 'savings' && <SavingsPage />}
        {page === 'budgets' && <BudgetGoals onSaved={refresh} />}
        {page === 'all-expenses' && (
          <ExpenseList refreshKey={refreshKey} onRefresh={refresh} />
        )}
      </main>
    </div>
  )
}

function ThemedApp() {
  const [mode, setMode] = useState('dark')
  const toggleMode = () => setMode(m => m === 'dark' ? 'light' : 'dark')

  return (
    <ColorsProvider mode={mode}>
      <ExpenseTypesProvider>
        <AppContent mode={mode} onToggleMode={toggleMode} />
      </ExpenseTypesProvider>
    </ColorsProvider>
  )
}

export default function App() {
  return <ThemedApp />
}
