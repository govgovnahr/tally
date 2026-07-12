import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the default label for a known status', () => {
    render(<StatusBadge status="over_budget" />)
    expect(screen.getByText('Over budget')).toBeInTheDocument()
  })

  it('prefers an explicit label over the status default', () => {
    render(<StatusBadge status="on_track" label="Custom label" />)
    expect(screen.getByText('Custom label')).toBeInTheDocument()
    expect(screen.queryByText('On track')).not.toBeInTheDocument()
  })

  it('falls back to the no_budget style for an unknown status', () => {
    render(<StatusBadge status="not_a_real_status" label="Mystery" />)
    const badge = screen.getByText('Mystery')
    expect(badge).toHaveStyle({ backgroundColor: 'var(--color-no-limit-bg)' })
  })
})
