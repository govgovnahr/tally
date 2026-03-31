import { useState, useEffect } from 'react'
import api from '../api.js'
import AddExpenseForm from './AddExpenseForm.jsx'
import './ExpenseList.css'

const EXPENSE_TYPES = ['Food', 'Transport', 'Housing', 'Entertainment', 'Health', 'Other']

const TYPE_COLORS = {
  Food:          '#e8a87c',
  Transport:     '#82b4e0',
  Housing:       '#c49ee8',
  Entertainment: '#f0c040',
  Health:        '#80cbc4',
  Other:         '#a0a0a0',
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export default function ExpenseList({ refreshKey, onRefresh }) {
  const [expenses, setExpenses] = useState([])
  const [activeType, setActiveType] = useState('All')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const params = activeType !== 'All' ? { type: activeType } : {}
    api.get('/expenses', { params }).then(res => setExpenses(res.data.expenses))
  }, [refreshKey, activeType])

  async function handleDelete(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    try {
      await api.delete(`/expenses/${id}`)
      onRefresh()
    } catch {
      api.get('/expenses', { params: activeType !== 'All' ? { type: activeType } : {} })
        .then(res => setExpenses(res.data.expenses))
    }
  }

  function handleAdded() {
    onRefresh()
  }

  const tabs = ['All', ...EXPENSE_TYPES]

  return (
    <div className="expense-section">
      <div className="expense-header">
        <h2 className="expense-title">Expenses</h2>
        <button className="btn-primary add-btn" onClick={() => setShowForm(true)}>
          + Add Expense
        </button>
      </div>

      <div className="type-tabs">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`type-tab ${activeType === tab ? 'active' : ''}`}
            style={activeType === tab && tab !== 'All' ? { borderBottomColor: TYPE_COLORS[tab], color: TYPE_COLORS[tab] } : {}}
            onClick={() => setActiveType(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {expenses.length === 0 ? (
        <div className="expense-empty">
          <span>No expenses {activeType !== 'All' ? `in ${activeType}` : 'yet'}</span>
        </div>
      ) : (
        <table className="expense-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Date</th>
              <th className="col-amount">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>
                  <span
                    className="type-badge"
                    style={{ color: TYPE_COLORS[e.type] || '#a0a0a0', borderColor: TYPE_COLORS[e.type] || '#a0a0a0' }}
                  >
                    {e.type}
                  </span>
                </td>
                <td className="col-date">{formatDate(e.date)}</td>
                <td className="col-amount">${e.amount.toFixed(2)}</td>
                <td className="col-delete">
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(e.id)}
                    title="Delete expense"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <AddExpenseForm
          onClose={() => setShowForm(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
