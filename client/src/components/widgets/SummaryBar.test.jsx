import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SummaryBar from './SummaryBar'

vi.mock('../../ExpenseTypesContext.jsx', () => ({
  useExpenseTypes: () => ({ typeMap: {} }),
}))

vi.mock('../charts/SpendingChart.jsx', () => ({
  default: () => null,
}))

// Renders as a plain button so tests can drive AddIncomeForm's onAdded
// callback directly without going through the real form/network flow —
// this test is about SummaryBar's own onAdded handler, not AddIncomeForm.
vi.mock('./AddIncomeForm.jsx', () => ({
  default: ({ onAdded }) => (
    <button onClick={() => onAdded({ id: 'new-income-1' })}>mock-submit</button>
  ),
}))

describe('SummaryBar income add flow', () => {
  it('does not throw and forwards the new id via onIncomeAdded (regression: fetchData was undefined)', () => {
    const onIncomeAdded = vi.fn()
    render(<SummaryBar onIncomeAdded={onIncomeAdded} />)

    fireEvent.click(screen.getByText('Add Income'))
    // Submitting used to throw a ReferenceError here (fetchData was never
    // defined in this file), which AddIncomeForm's try/catch would swallow
    // and surface as a false "Failed to add income" error to the user even
    // though the income had already been created server-side.
    expect(() => fireEvent.click(screen.getByText('mock-submit'))).not.toThrow()

    expect(onIncomeAdded).toHaveBeenCalledWith('new-income-1')
    expect(screen.queryByText('mock-submit')).not.toBeInTheDocument() // dialog closed
  })
})
