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

export default function SummaryBar({ refreshKey }) {
  const [summary, setSummary] = useState([])

  useEffect(() => {
    api.get('/expenses/summary').then(res => setSummary(res.data))
  }, [refreshKey])

  const grandTotal = summary.reduce((sum, s) => sum + s.total, 0)

  return (
    <div className="summary-section">
      <div className="summary-header">
        <span className="summary-label">Total Spending</span>
        <span className="summary-grand-total">${grandTotal.toFixed(2)}</span>
      </div>
      <div className="summary-cards">
        {summary.map(s => {
          const config = TYPE_CONFIG[s.type] || { color: '#a0a0a0', icon: '📦' }
          return (
            <div
              key={s.type}
              className="summary-card"
              style={{ borderTopColor: config.color }}
            >
              <div className="summary-card-icon">{config.icon}</div>
              <div className="summary-card-type">{s.type}</div>
              <div className="summary-card-total" style={{ color: config.color }}>
                ${s.total.toFixed(2)}
              </div>
              <div className="summary-card-count">{s.count} {s.count === 1 ? 'expense' : 'expenses'}</div>
            </div>
          )
        })}
        {summary.length === 0 && (
          <p className="summary-empty">No expenses yet. Add one below!</p>
        )}
      </div>
    </div>
  )
}
