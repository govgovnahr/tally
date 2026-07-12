import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DollarInput from './DollarInput'

describe('DollarInput', () => {
  it('renders the dollar sign and current value', () => {
    render(<DollarInput value="42.50" onChange={() => {}} />)
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toHaveValue(42.5)
  })

  it('shows the placeholder when value is empty', () => {
    render(<DollarInput value="" onChange={() => {}} placeholder="No limit" />)
    expect(screen.getByPlaceholderText('No limit')).toBeInTheDocument()
  })

  it('calls onChange when the user types', () => {
    const onChange = vi.fn()
    render(<DollarInput value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('disables the input when disabled is set', () => {
    render(<DollarInput value="10" onChange={() => {}} disabled />)
    expect(screen.getByRole('spinbutton')).toBeDisabled()
  })
})
