import { describe, it, expect } from 'vitest'
import { formatDate, formatShortDate, formatMonthLabel, formatPeriodRange } from './format'

describe('format', () => {
  it('formatDate renders a full US-style date', () => {
    expect(formatDate('2026-05-03')).toBe('May 3, 2026')
  })

  it('formatShortDate omits the year', () => {
    expect(formatShortDate('2026-05-03')).toBe('May 3')
  })

  it('formatMonthLabel renders month and year', () => {
    expect(formatMonthLabel('2026-05')).toBe('May 2026')
  })

  it('formatPeriodRange shows the last inclusive day, not the exclusive end', () => {
    // period_end is exclusive: a Jun 23 - Jul 23 period should display through Jul 22
    expect(formatPeriodRange('2026-06-23', '2026-07-23')).toBe('Jun 23 – Jul 22')
  })

  it('formatPeriodRange handles a period end that crosses a month boundary', () => {
    // exclusive end of 2026-03-01 means the last inclusive day is Feb 28
    expect(formatPeriodRange('2026-02-01', '2026-03-01')).toBe('Feb 1 – Feb 28')
  })
})
