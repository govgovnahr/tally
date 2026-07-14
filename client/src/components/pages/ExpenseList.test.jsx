import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ExpenseList from './ExpenseList'

// glasscn-ui pre-bundles its own React copy, which jsdom rejects ("element from
// an older version of React"). Swap Card for a plain wrapper for the test.
vi.mock('glasscn-ui', () => ({ Card: ({ children }) => <div>{children}</div> }))

vi.mock('../../ExpenseTypesContext.jsx', () => ({
  useExpenseTypes: () => ({ typeNames: ['Food', 'Other'], typeMap: {}, macroMap: {} }),
}))

vi.mock('../../TutorialContext.jsx', () => ({
  useTutorial: () => ({ suggestAdvancedTour: () => {} }),
}))

// Heavy/unrelated dialogs — this test is about ExpenseList's own filtering/display,
// not theirs.
vi.mock('../widgets/AddExpenseForm.jsx', () => ({ default: () => null }))
vi.mock('../widgets/AddIncomeForm.jsx', () => ({ default: () => null }))
vi.mock('../dialogs/ImportDialog.jsx', () => ({ default: () => null }))
vi.mock('../dialogs/ReceiptScanDialog.jsx', () => ({ default: () => null }))

const mockGet = vi.fn()
vi.mock('../../api.js', () => ({
  default: { get: (...args) => mockGet(...args) },
}))

// jsdom's window.localStorage isn't reliably available in this test environment
// (Node's own global localStorage shadows it); ExpenseList reads it once on mount
// for a display-preference default, so stub it directly.
const localStorageStub = { getItem: () => null, setItem: () => {} }
vi.stubGlobal('localStorage', localStorageStub)

function renderList(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ExpenseList {...props} />
    </QueryClientProvider>
  )
}

const BASE_EXPENSE = {
  id: '1', name: 'Latte', amount: 5.5, type: 'Food',
  date: '2026-05-01', is_recurring: 0,
}

function mockExpenses(expenses) {
  return Promise.resolve({ data: { expenses, total: expenses.length, page: 1, page_size: 50 } })
}

beforeEach(() => {
  mockGet.mockReset()
  mockGet.mockImplementation((url) => {
    if (url === '/expenses') return mockExpenses([])
    if (url === '/expenses/subcategories') return Promise.resolve({ data: [] })
    if (url === '/analysis/outliers') return Promise.resolve({ data: [] })
    if (url === '/settings') return Promise.resolve({ data: { ai_enabled: false } })
    return Promise.resolve({ data: {} })
  })
})

describe('ExpenseList subcategory filter and display', () => {
  it('does not render the subcategory filter when there are no suggestions', async () => {
    renderList()
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/expenses/subcategories'))
    expect(screen.queryByText('All subcategories')).not.toBeInTheDocument()
  })

  it('adds subcategory to the /expenses query params when a filter option is selected', async () => {
    mockGet.mockImplementation((url) => {
      if (url === '/expenses') return mockExpenses([{ ...BASE_EXPENSE, subcategory: 'Coffee Shops' }])
      if (url === '/expenses/subcategories') return Promise.resolve({ data: ['Coffee Shops', 'Groceries'] })
      if (url === '/analysis/outliers') return Promise.resolve({ data: [] })
      if (url === '/settings') return Promise.resolve({ data: { ai_enabled: false } })
      return Promise.resolve({ data: {} })
    })
    renderList()

    const select = await screen.findByDisplayValue('All subcategories')
    fireEvent.change(select, { target: { value: 'Coffee Shops' } })

    await waitFor(() => {
      const call = mockGet.mock.calls.find(c => c[0] === '/expenses' && c[1]?.params?.subcategory === 'Coffee Shops')
      expect(call).toBeTruthy()
    })
  })

  it('renders a subcategory tag for a row that has one, and omits it otherwise', async () => {
    mockGet.mockImplementation((url) => {
      if (url === '/expenses') return mockExpenses([
        { ...BASE_EXPENSE, id: '1', name: 'Latte', subcategory: 'Coffee Shops' },
        { ...BASE_EXPENSE, id: '2', name: 'Cereal', subcategory: null },
      ])
      if (url === '/expenses/subcategories') return Promise.resolve({ data: ['Coffee Shops'] })
      if (url === '/analysis/outliers') return Promise.resolve({ data: [] })
      if (url === '/settings') return Promise.resolve({ data: { ai_enabled: false } })
      return Promise.resolve({ data: {} })
    })
    renderList()

    // Both the mobile card list and desktop table render simultaneously in jsdom
    // (Tailwind's sm:hidden/hidden sm:block aren't applied without real media queries).
    expect((await screen.findAllByText('Coffee Shops')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Latte')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('Cereal')).length).toBeGreaterThan(0)
  })
})
