import { useState, useEffect } from 'react'
import api from '../api.js'
import './SummaryBar.css'

const TYPE_CONFIG = {
  Food:          { color: '#e8a87c', icon: '🍔' },
  Transport:     { color: '#82b4e0', icon: '🚌' },
  Housing:       { color: '#c49ee8', icon: '🏠' },
  Entertainment: { color: '#f0c040', icon: '🎬' },
  Health:        { color: '#80cbc4', icon: '💊' },
  Other:         { color: '#a0a0a0', icon: '📦' },
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel() {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export default function SummaryBar({ refreshKey }) {
  const [summary, setSummary] = useState([])
  const [budgets, setBudgets] = useState({})

  useEffect(() => {
    const month = currentMonth()
    Promise.all([
      api.get('/expenses/summary', { params: { month } }),
      api.get('/budgets'),
    ]).then(([summaryRes, budgetsRes]) => {
      setSummary(summaryRes.data)
      const budgetMap = {}
      budgetsRes.data.forEach(b => { budgetMap[b.type] = b.monthly_limit })
      setBudgets(budgetMap)
    })
  }, [refreshKey])

  const totalSpent = summary.reduce((sum, s) => sum + s.total, 0)
  const totalBudget = Object.values(budgets).reduce((sum, v) => sum + v, 0)
  const grandPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : null
  const grandOver = totalBudget > 0 && totalSpent > totalBudget

  return (
    <div className="summary-section">
      <div className="summary-header">
        <div>
          <span className="summary-label">{monthLabel()}</span>
          <div className="summary-grand-total">${totalSpent.toFixed(2)}</div>
          {totalBudget > 0 && (
            <div className="summary-grand-limit">
              of ${totalBudget.toFixed(2)} budget
            </div>
          )}
        </div>
        {grandPct !== null && (
          <div className="summary-grand-progress">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${grandPct}%`,
                  background: grandOver ? '#e07c7c' : '#8fb996',
                }}
              />
            </div>
            <span className="progress-pct" style={{ color: grandOver ? '#e07c7c' : 'var(--text-secondary)' }}>
              {grandOver ? 'Over budget' : `${Math.round(grandPct)}%`}
            </span>
          </div>
        )}
      </div>

      <div className="summary-cards">
        {summary.map(s => {
          const config = TYPE_CONFIG[s.type] || { color: '#a0a0a0', icon: '📦' }
          const limit = budgets[s.type]
          const pct = limit > 0 ? Math.min((s.total / limit) * 100, 100) : null
          const over = limit > 0 && s.total > limit

          return (
            <div
              key={s.type}
              className="summary-card"
              style={{ borderTopColor: config.color }}
            >
              <div className="summary-card-icon">{config.icon}</div>
              <div className="summary-card-type">{s.type}</div>
              <div className="summary-card-total" style={{ color: over ? '#e07c7c' : config.color }}>
                ${s.total.toFixed(2)}
                {limit > 0 && (
                  <span className="summary-card-limit"> / ${limit.toFixed(0)}</span>
                )}
              </div>
              {pct !== null && (
                <div className="progress-track" style={{ marginBottom: 4 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: over ? '#e07c7c' : config.color,
                    }}
                  />
                </div>
              )}
              <div className="summary-card-count">
                {s.count} {s.count === 1 ? 'expense' : 'expenses'}
                {over && <span className="over-badge"> · Over!</span>}
              </div>
            </div>
          )
        })}
        {summary.length === 0 && (
          <p className="summary-empty">No expenses this month yet. Add one below!</p>
        )}
      </div>
    </div>
  )
}
