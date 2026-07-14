import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddExpenseForm from './AddExpenseForm'

vi.mock('../../ExpenseTypesContext.jsx', () => ({
  useExpenseTypes: () => ({ typeNames: ['Food', 'Other'] }),
}))

const mockGet = vi.fn((url) => {
  if (url === '/settings') return Promise.resolve({ data: { ai_enabled: false } })
  if (url === '/expenses/subcategories') return Promise.resolve({ data: ['Coffee Shops', 'Groceries'] })
  return Promise.resolve({ data: {} })
})
const mockPost = vi.fn()
const mockPut = vi.fn()
vi.mock('../../api.js', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
  },
  getErrorMessage: (err, fallback) => err?.response?.data?.detail ?? fallback,
}))

function renderForm(props = {}) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <AddExpenseForm onClose={() => {}} onAdded={() => {}} {...props} />
    </QueryClientProvider>
  )
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText('e.g. Groceries'), { target: { value: 'Test Expense' } })
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '12.34' } })
}

beforeEach(() => {
  mockGet.mockClear()
  mockPost.mockReset()
  mockPut.mockReset()
})

describe('AddExpenseForm subcategory field', () => {
  it('renders the subcategory input and its datalist suggestions', async () => {
    renderForm()
    const input = screen.getByPlaceholderText('e.g. Coffee Shops')
    expect(input).toBeInTheDocument()

    // Dialog content is portaled to document.body by Radix, not into RTL's `container`.
    await waitFor(() => {
      const options = document.body.querySelectorAll('#subcategory-suggestions option')
      expect(options.length).toBe(2)
    })
  })

  it('sends the trimmed subcategory in the POST payload', async () => {
    mockPost.mockResolvedValue({ data: { id: '1' } })
    renderForm()
    fillRequiredFields()
    fireEvent.change(screen.getByPlaceholderText('e.g. Coffee Shops'), { target: { value: '  Coffee Shops  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    const [url, payload] = mockPost.mock.calls[0]
    expect(url).toBe('/expenses')
    expect(payload.subcategory).toBe('Coffee Shops')
  })

  it('sends null when the subcategory field is left blank', async () => {
    mockPost.mockResolvedValue({ data: { id: '1' } })
    renderForm()
    fillRequiredFields()
    fireEvent.click(screen.getByRole('button', { name: 'Add Expense' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    const [, payload] = mockPost.mock.calls[0]
    expect(payload.subcategory).toBeNull()
  })

  it('pre-fills the subcategory input when editing an existing expense', () => {
    renderForm({
      expense: {
        id: '1', name: 'Latte', amount: 5, type: 'Food',
        date: '2026-05-01', is_recurring: 0, subcategory: 'Coffee Shops',
      },
    })
    expect(screen.getByPlaceholderText('e.g. Coffee Shops')).toHaveValue('Coffee Shops')
  })
})
