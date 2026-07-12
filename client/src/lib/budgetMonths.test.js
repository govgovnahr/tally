import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { currentMonth, nextMonth, lastMonth, addMonths, buildOverrideMonthOptions, buildPlanMonthOptions } from './budgetMonths'

describe('budgetMonths', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('currentMonth reflects today', () => {
    vi.setSystemTime(new Date(2026, 5, 15)) // June 2026 (JS months are 0-indexed)
    expect(currentMonth()).toBe('2026-06')
  })

  it('nextMonth rolls over within a year', () => {
    vi.setSystemTime(new Date(2026, 5, 15))
    expect(nextMonth()).toBe('2026-07')
  })

  it('nextMonth rolls over across a year boundary', () => {
    vi.setSystemTime(new Date(2026, 11, 15)) // December
    expect(nextMonth()).toBe('2027-01')
  })

  it('lastMonth rolls back within a year', () => {
    vi.setSystemTime(new Date(2026, 5, 15))
    expect(lastMonth()).toBe('2026-05')
  })

  it('lastMonth rolls back across a year boundary', () => {
    vi.setSystemTime(new Date(2026, 0, 15)) // January
    expect(lastMonth()).toBe('2025-12')
  })

  it('addMonths handles same-year offsets', () => {
    expect(addMonths('2026-03', 2)).toBe('2026-05')
  })

  it('addMonths rolls forward across a year boundary', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
  })

  it('addMonths rolls backward across a year boundary', () => {
    expect(addMonths('2026-01', -2)).toBe('2025-11')
  })

  it('buildOverrideMonthOptions returns 12 consecutive months ending near today', () => {
    vi.setSystemTime(new Date(2026, 5, 15))
    const options = buildOverrideMonthOptions()
    expect(options).toHaveLength(12)
    const keys = options.map((o) => o.key)
    // consecutive, no gaps or duplicates
    for (let i = 1; i < keys.length; i++) {
      expect(addMonths(keys[i - 1], 1)).toBe(keys[i])
    }
  })

  it('buildPlanMonthOptions starts at the current month and runs 12 months forward', () => {
    vi.setSystemTime(new Date(2026, 5, 15))
    const options = buildPlanMonthOptions()
    expect(options).toHaveLength(12)
    expect(options[0].key).toBe('2026-06')
    expect(options[11].key).toBe('2027-05')
  })
})
