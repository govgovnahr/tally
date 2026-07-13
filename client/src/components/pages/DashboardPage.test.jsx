import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from './DashboardPage'

// Mock the feature children that fetch their own data or are heavy to render —
// this test is about DashboardPage's own data-loading, not theirs.
vi.mock('../charts/MonthlyTrendsChart.jsx', () => ({ default: () => null }))
vi.mock('../widgets/SummaryBar.jsx', () => ({ default: () => null }))
vi.mock('./ExpenseList.jsx', () => ({ default: () => null }))
vi.mock('../charts/OutlierAlert.jsx', () => ({ default: () => null }))
vi.mock('../charts/SpendingDonut.jsx', () => ({ default: () => null }))
vi.mock('../widgets/SavingsGoalsMini.jsx', () => ({ default: () => null }))
vi.mock('../widgets/AIInsightsCard.jsx', () => ({ default: () => null }))
vi.mock('../inputs/MonthSelector.jsx', () => ({ default: () => null }))
vi.mock('../widgets/AddIncomeForm.jsx', () => ({ default: () => null }))

// glasscn-ui pre-bundles its own React copy, which jsdom rejects ("element from
// an older version of React"). Swap Card for a plain wrapper for the test.
vi.mock('glasscn-ui', () => ({ Card: ({ children }) => <div>{children}</div> }))

vi.mock('../../ExpenseTypesContext.jsx', () => ({
  useExpenseTypes: () => ({ typeMap: {} }),
}))

const mockGet = vi.fn()
vi.mock('../../api.js', () => ({
  default: { get: (...args) => mockGet(...args) },
}))

const DASH_FIXTURE = {
  month: '2026-05',
  period: { period_start: '2026-05-01', period_end: '2026-06-01', period_label: '2026-05' },
  expenses_summary: [{ type: 'Food', total: 75.0, count: 2 }],
  incomes_summary: { total: 2200.0 },
  macrocategories_summary: [],
  budgets_effective: [{ type: 'Food', monthly_limit: 300.0, is_override: false }],
  pacing: { month: '2026-05', is_current_month: true, categories: [] },
  outliers: [],
  savings_goals: [],
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DashboardPage selectedMonth="2026-05" onMonthChange={() => {}} onNavigate={() => {}} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockImplementation((url) => {
    if (url === '/dashboard') return Promise.resolve({ data: DASH_FIXTURE })
    return Promise.resolve({ data: {} })
  })
})

describe('DashboardPage data loading', () => {
  it('fetches everything from a single /dashboard request', async () => {
    renderDashboard()
    await waitFor(() => {
      const urls = mockGet.mock.calls.map((c) => c[0])
      expect(urls).toContain('/dashboard')
    })

    const urls = mockGet.mock.calls.map((c) => c[0])
    // The consolidation's whole point: the page no longer fans out to the old
    // per-section endpoints or the period-bounds waterfall.
    expect(urls.filter((u) => u === '/dashboard')).toHaveLength(1)
    expect(urls).not.toContain('/expenses/summary')
    expect(urls).not.toContain('/incomes/summary')
    expect(urls).not.toContain('/macrocategories/summary')
    expect(urls).not.toContain('/analysis/pacing')
    expect(urls).not.toContain('/settings/period-bounds')
  })

  it('renders income from the dashboard payload', async () => {
    renderDashboard()
    // $2,200 total income from the fixture should surface in a KPI card.
    expect(await screen.findByText(/2,200|2200/)).toBeInTheDocument()
  })
})
