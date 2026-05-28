import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { Home, BarChart2, PiggyBank, Landmark, Receipt, Sun, Moon, UserCircle, HelpCircle, MessageCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { TallyLogo } from './components/ui/TallyLogo.jsx'
import api from './api.js'
import { supabase } from './supabase.js'
import { ExpenseTypesProvider, useExpenseTypes } from './ExpenseTypesContext.jsx'
import { TutorialProvider, useTutorial } from './TutorialContext.jsx'
import { ColorsProvider, useC } from './colors'
import { TooltipProvider } from '@/components/ui/tooltip'
import { qk } from './queryKeys.js'
import ExpenseList from './components/pages/ExpenseList.jsx'
import DashboardPage from './components/pages/DashboardPage.jsx'
import AuthPage from './components/pages/AuthPage.jsx'

const BudgetGoals  = lazy(() => import('./components/pages/BudgetGoals.jsx'))
const SavingsPage  = lazy(() => import('./components/pages/SavingsPage.jsx'))
const AnalysisPage = lazy(() => import('./components/pages/AnalysisPage.jsx'))
const AccountPage  = lazy(() => import('./components/pages/AccountPage.jsx'))
const ChatPage     = lazy(() => import('./components/pages/ChatPage.jsx'))

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

const NAV_ITEMS = [
  { value: 'home',         label: 'Overview',  Icon: Home },
  { value: 'analysis',     label: 'Analysis',  Icon: BarChart2 },
  { value: 'savings',      label: 'Savings',   Icon: PiggyBank },
  { value: 'budgets',      label: 'Budgets',   Icon: Landmark },
  { value: 'all-expenses', label: 'Expenses',  Icon: Receipt },
  { value: 'chat',         label: 'Ask Tally', Icon: MessageCircle },
]

function AppContent({ mode, onToggleMode, onLogout, user }) {
  const C = useC()
  const { loading: typesLoading } = useExpenseTypes()
  const { registerNavigate, trackPage, start: startTour, suggestOnboardingTour } = useTutorial()
  const [page, setPage] = useState('home')
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [outlierMonth, setOutlierMonth] = useState(null)
  const [initialExpenseType, setInitialExpenseType] = useState(null)
  const [initialExpenseId, setInitialExpenseId] = useState(null)
  const [initialExpenseMonth, setInitialExpenseMonth] = useState(null)

  const { data: budgetsData, isLoading: budgetsLoading } = useQuery({
    queryKey: qk.budgets(),
    queryFn: () => api.get('/budgets').then(r => r.data),
    staleTime: 5 * 60_000,
  })

  // Give the tutorial context access to navigation and track current page
  useEffect(() => { registerNavigate(pg => setPage(pg)) }, [])
  useEffect(() => { trackPage(page) }, [page])

  // Auto-start onboarding tour for brand new users
  useEffect(() => {
    if (!localStorage.getItem('tally_tour_seen') && !localStorage.getItem('tally_onboarding_seen')) {
      const t = setTimeout(() => startTour('onboarding'), 500)
      return () => clearTimeout(t)
    }
  }, [])

  // Prompt existing users who have never seen the onboarding tour
  useEffect(() => {
    const t = setTimeout(() => suggestOnboardingTour(), 1500)
    return () => clearTimeout(t)
  }, [])

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

  if (budgetsLoading || typesLoading) return (
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
        <div className="flex gap-1 flex-1" data-tour="nav">
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

        {/* Theme toggle + help + account */}
        <div className="flex items-center gap-1" style={{ position: 'relative' }}>
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
            onClick={() => setHelpMenuOpen(o => !o)}
            className="p-1.5 rounded-lg border-none cursor-pointer transition-colors duration-150"
            style={{ color: helpMenuOpen ? C.navText : 'var(--text-on-nav-muted)', backgroundColor: 'transparent' }}
            title="Tour & help"
          >
            <HelpCircle size={18} />
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
            onClick={() => setHelpMenuOpen(o => !o)}
            className="p-1.5 rounded-lg border-none cursor-pointer"
            style={{ color: helpMenuOpen ? C.navText : 'var(--text-on-nav-muted)', backgroundColor: 'transparent' }}
            title="Tour & help"
          >
            <HelpCircle size={16} />
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
        data-tour="nav-mobile"
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

      {/* Help dropdown — rendered outside both navs so it's visible on mobile and desktop */}
      {helpMenuOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setHelpMenuOpen(false)} />
          <div style={{
            position: 'fixed', top: 60, right: 12, zIndex: 9000,
            backgroundColor: C.surfacePopup,
            border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '6px 0',
            boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
            minWidth: 200,
          }}>
            {[
              { id: 'basic',      label: 'Quick Tour',        desc: 'Overview of every section' },
              { id: 'onboarding', label: 'Getting Started',   desc: 'Set budgets & log expenses' },
              { id: 'advanced',   label: 'Advanced Features', desc: 'Projections, overrides & import' },
            ].map(({ id, label, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setHelpMenuOpen(false); startTour(id) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = C.hover}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.warmText }}>{label}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{desc}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Page content */}
      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 pb-[72px] sm:pb-6">
        {page === 'home' && (
          <DashboardPage
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            onNavigate={handleNavigate}
          />
        )}
        <Suspense fallback={null}>
          {page === 'analysis' && (
            <AnalysisPage outlierMonth={outlierMonth} onClearOutlierMonth={() => setOutlierMonth(null)} onShowInExpenses={handleShowInExpenses} />
          )}
          {page === 'savings' && <SavingsPage />}
          {page === 'budgets' && <BudgetGoals />}
          {page === 'account' && <AccountPage user={user} onLogout={onLogout} />}
          {page === 'chat' && <ChatPage />}
        </Suspense>
        {page === 'all-expenses' && (
          <ExpenseList
            initialType={initialExpenseType}
            initialHighlightId={initialExpenseId}
            initialMonth={initialExpenseMonth}
            onInitialTypeConsumed={() => { setInitialExpenseType(null); setInitialExpenseId(null); setInitialExpenseMonth(null) }}
          />
        )}
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
      setUser(session ? { id: session.user.id, email: session.user.email } : null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') return
      if (event === 'SIGNED_IN' && session) {
        api.get('/auth/me')
          .catch(() => {})
          .finally(() => setUser({ id: session.user.id, email: session.user.email }))
      } else if (session) {
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
    <TooltipProvider delayDuration={300}>
      <ColorsProvider mode={mode}>
        <ExpenseTypesProvider>
          <TutorialProvider>
            <AppContent mode={mode} onToggleMode={toggleMode} onLogout={handleLogout} user={user} />
          </TutorialProvider>
        </ExpenseTypesProvider>
      </ColorsProvider>
    </TooltipProvider>
  )
}

export default function App() {
  return <ThemedApp />
}
