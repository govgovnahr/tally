export function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function formatShortDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

export function formatMonthLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

// periodEnd is exclusive (the day the next period starts) — display the last inclusive day.
export function formatPeriodRange(periodStart, periodEnd) {
  const [ey, em, ed] = periodEnd.split('-').map(Number)
  const lastInclusive = new Date(ey, em - 1, ed - 1)
  const lastInclusiveStr = `${lastInclusive.getFullYear()}-${String(lastInclusive.getMonth() + 1).padStart(2, '0')}-${String(lastInclusive.getDate()).padStart(2, '0')}`
  return `${formatShortDate(periodStart)} – ${formatShortDate(lastInclusiveStr)}`
}
