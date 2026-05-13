export function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function nextMonth() {
  const now = new Date()
  const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const m = now.getMonth() === 11 ? 1 : now.getMonth() + 2
  return `${y}-${String(m).padStart(2, '0')}`
}

export function lastMonth() {
  const now = new Date()
  const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const m = now.getMonth() === 0 ? 12 : now.getMonth()
  return `${y}-${String(m).padStart(2, '0')}`
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const total = (y * 12 + m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function buildOverrideMonthOptions() {
  const result = []
  const now = new Date()
  let y = now.getFullYear(), m = now.getMonth() - 10
  while (m <= 0) { m += 12; y-- }
  for (let i = 0; i < 12; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    result.push({ key, label: new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }) })
    if (++m > 12) { m = 1; y++ }
  }
  return result
}

export function buildPlanMonthOptions() {
  const cur = currentMonth()
  return Array.from({ length: 12 }, (_, i) => {
    const key = addMonths(cur, i)
    const [y, m] = key.split('-').map(Number)
    return {
      key,
      label: new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      short: new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
    }
  })
}

export const OVERRIDE_MONTH_OPTIONS = buildOverrideMonthOptions()
export const PLAN_MONTH_OPTIONS = buildPlanMonthOptions()
