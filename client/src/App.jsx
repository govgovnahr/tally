import { useState, useCallback, useEffect } from 'react'
import './App.css'
import api from './api.js'
import SummaryBar from './components/SummaryBar.jsx'
import ExpenseList from './components/ExpenseList.jsx'
import BudgetSetup from './components/BudgetSetup.jsx'

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [budgetsReady, setBudgetsReady] = useState(null) // null = loading

  useEffect(() => {
    api.get('/budgets').then(res => {
      setBudgetsReady(res.data.length > 0)
    })
  }, [refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  if (budgetsReady === null) return null // loading

  if (!budgetsReady) {
    return <BudgetSetup onComplete={refresh} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="header-icon">💰</span>
        <h1>Budget Tracker</h1>
      </header>
      <main className="app-body">
        <SummaryBar refreshKey={refreshKey} />
        <ExpenseList refreshKey={refreshKey} onRefresh={refresh} />
      </main>
    </div>
  )
}
