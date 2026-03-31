import { useState } from 'react'
import api from '../api.js'
import './BudgetSetup.css'

const TYPES = [
  { type: 'Food',          icon: '🍔' },
  { type: 'Transport',     icon: '🚌' },
  { type: 'Housing',       icon: '🏠' },
  { type: 'Entertainment', icon: '🎬' },
  { type: 'Health',        icon: '💊' },
  { type: 'Other',         icon: '📦' },
]

export default function BudgetSetup({ onComplete }) {
  const [limits, setLimits] = useState(
    Object.fromEntries(TYPES.map(t => [t.type, '']))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(type, value) {
    setLimits(prev => ({ ...prev, [type]: value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const budgets = TYPES
      .filter(t => limits[t.type] !== '' && Number(limits[t.type]) > 0)
      .map(t => ({ type: t.type, monthly_limit: parseFloat(limits[t.type]) }))

    if (budgets.length === 0) {
      return setError('Enter at least one budget limit to get started.')
    }

    setLoading(true)
    try {
      await api.post('/budgets', budgets)
      onComplete()
    } catch {
      setError('Failed to save budgets. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    // Save a placeholder so we don't show setup again
    await api.post('/budgets', [{ type: 'Other', monthly_limit: 0 }])
    onComplete()
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-header">
          <span className="setup-icon">💰</span>
          <h1>Welcome to Budget Tracker</h1>
          <p>Set your monthly spending goals to get started. You can update these anytime.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="setup-rows">
            {TYPES.map(({ type, icon }) => (
              <div key={type} className="setup-row">
                <span className="setup-row-icon">{icon}</span>
                <span className="setup-row-label">{type}</span>
                <div className="setup-row-input">
                  <span className="input-prefix">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={limits[type]}
                    onChange={e => handleChange(type, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          {error && <p className="setup-error">{error}</p>}
          <div className="setup-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Get Started'}
            </button>
            <button type="button" className="btn-skip" onClick={handleSkip}>
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
