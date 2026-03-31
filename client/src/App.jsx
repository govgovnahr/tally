import { useState, useCallback } from 'react'
import './App.css'
import SummaryBar from './components/SummaryBar.jsx'
import ExpenseList from './components/ExpenseList.jsx'

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

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
