import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from './api.js'

const ExpenseTypesContext = createContext(null)

export function ExpenseTypesProvider({ children }) {
  const [expenseTypes, setExpenseTypes] = useState([])
  const [loading, setLoading] = useState(true)

  const reloadTypes = useCallback(() => {
    return api.get('/expense-types').then(res => {
      setExpenseTypes(res.data)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    reloadTypes()
  }, [reloadTypes])

  const typeMap = Object.fromEntries(expenseTypes.map(t => [t.name, t]))
  const typeNames = expenseTypes.map(t => t.name)

  return (
    <ExpenseTypesContext.Provider value={{ expenseTypes, typeMap, typeNames, reloadTypes, loading }}>
      {children}
    </ExpenseTypesContext.Provider>
  )
}

export function useExpenseTypes() {
  return useContext(ExpenseTypesContext)
}
