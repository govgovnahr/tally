import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddIncomeForm from './AddIncomeForm'

vi.mock('../../ExpenseTypesContext.jsx', () => ({
  useExpenseTypes: () => ({ expenseTypes: [] }),
}))

const mockPost = vi.fn()
const mockPut = vi.fn()
vi.mock('../../api.js', () => ({
  default: { post: (...args) => mockPost(...args), put: (...args) => mockPut(...args) },
  getErrorMessage: (err, fallback) => err?.response?.data?.detail ?? fallback,
}))

function renderForm(props = {}) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <AddIncomeForm onClose={() => {}} onAdded={() => {}} {...props} />
    </QueryClientProvider>
  )
}

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText('e.g. Salary, Freelance'), { target: { value: 'Monthly Paycheck' } })
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '3000' } })
}

beforeEach(() => {
  mockPost.mockReset()
  mockPut.mockReset()
})

describe('AddIncomeForm', () => {
  it('submits with an AbortController signal', async () => {
    mockPost.mockResolvedValue({ data: { id: '1' } })
    renderForm()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Add Income' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    const [url, payload, config] = mockPost.mock.calls[0]
    expect(url).toBe('/incomes')
    expect(payload.name).toBe('Monthly Paycheck')
    expect(config.signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts the in-flight request when the dialog unmounts before the response arrives', async () => {
    let capturedSignal
    mockPost.mockImplementation((url, payload, config) => {
      capturedSignal = config.signal
      return new Promise(() => {}) // never resolves, simulating a hung request
    })
    const { unmount } = renderForm()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Add Income' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1))
    expect(capturedSignal.aborted).toBe(false)

    unmount()
    expect(capturedSignal.aborted).toBe(true)
  })

  it('shows the backend dedup message on a 409 duplicate response', async () => {
    mockPost.mockRejectedValue({
      response: { status: 409, data: { detail: 'This looks like a duplicate of an income you just added.' } },
    })
    renderForm()
    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Add Income' }))

    expect(await screen.findByText('This looks like a duplicate of an income you just added.')).toBeInTheDocument()
  })

  it('disables the submit button while the request is in flight', async () => {
    mockPost.mockImplementation(() => new Promise(() => {}))
    renderForm()
    fillValidForm()
    const button = screen.getByRole('button', { name: 'Add Income' })
    fireEvent.click(button)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled())
  })
})
