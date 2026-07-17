import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import App from './App.jsx'

// jsdom's window.localStorage isn't reliably available in this test environment
// (Node's own global localStorage shadows it) — stub it with a real in-memory
// store so the persisted-page behavior under test is actually observable.
const localStorageStore = new Map()
const localStorageStub = {
  getItem: (k) => (localStorageStore.has(k) ? localStorageStore.get(k) : null),
  setItem: (k, v) => localStorageStore.set(k, String(v)),
  clear: () => localStorageStore.clear(),
}
vi.stubGlobal('localStorage', localStorageStub)

vi.mock('./supabase.js', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1', email: 'a@b.com' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
  },
}))

const mockGet = vi.fn((url) => {
  if (url === '/settings') return Promise.resolve({ data: { seen_category_migration_notice: true } })
  return Promise.resolve({ data: [] })
})
vi.mock('./api.js', () => ({
  default: { get: (...args) => mockGet(...args), put: vi.fn(() => Promise.resolve({ data: {} })) },
}))

vi.mock('./ExpenseTypesContext.jsx', () => ({
  ExpenseTypesProvider: ({ children }) => children,
  useExpenseTypes: () => ({ loading: false }),
}))

vi.mock('./TutorialContext.jsx', () => ({
  TutorialProvider: ({ children }) => children,
  useTutorial: () => ({ registerNavigate: () => {}, trackPage: () => {}, start: () => {}, suggestOnboardingTour: () => {} }),
}))

vi.mock('./components/pages/DashboardPage.jsx', () => ({ default: () => <div>DASHBOARD_PAGE</div> }))
vi.mock('./components/pages/ExpenseList.jsx', () => ({ default: () => <div>EXPENSE_LIST_PAGE</div> }))
vi.mock('./components/pages/AnalysisPage.jsx', () => ({ default: () => <div>ANALYSIS_PAGE</div> }))
vi.mock('./components/pages/SavingsPage.jsx', () => ({ default: () => <div>SAVINGS_PAGE</div> }))
vi.mock('./components/pages/BudgetGoals.jsx', () => ({ default: () => <div>BUDGETS_PAGE</div> }))
vi.mock('./components/pages/AccountPage.jsx', () => ({ default: () => <div>ACCOUNT_PAGE</div> }))
vi.mock('./components/pages/ChatPage.jsx', () => ({ default: () => <div>CHAT_PAGE</div> }))

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  mockGet.mockClear()
})

describe('App page persistence across reload', () => {
  it('defaults to Overview when no page was previously stored', async () => {
    renderApp()
    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
  })

  it('restores the last visited (non-overview) page from a prior session', async () => {
    localStorage.setItem('tally_page', 'analysis')
    renderApp()
    expect(await screen.findByText('ANALYSIS_PAGE')).toBeInTheDocument()
  })

  it('falls back to Overview for an unrecognized stored page value', async () => {
    localStorage.setItem('tally_page', 'not-a-real-page')
    renderApp()
    expect(await screen.findByText('DASHBOARD_PAGE')).toBeInTheDocument()
  })

  it('persists navigation so a reload would land back on the same page', async () => {
    renderApp()
    await screen.findByText('DASHBOARD_PAGE')

    fireEvent.click(screen.getAllByText('Savings')[0])

    expect(await screen.findByText('SAVINGS_PAGE')).toBeInTheDocument()
    expect(localStorage.getItem('tally_page')).toBe('savings')
  })
})
