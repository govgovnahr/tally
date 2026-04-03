import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from './api.js'

const ExpenseTypesContext = createContext(null)

export function ExpenseTypesProvider({ children }) {
  const [expenseTypes, setExpenseTypes] = useState([])
  const [macrocategories, setMacrocategories] = useState([])
  const [loading, setLoading] = useState(true)

  const reloadTypes = useCallback(() => {
    return api.get('/expense-types').then(res => {
      setExpenseTypes(res.data)
    }).finally(() => setLoading(false))
  }, [])

  const reloadMacros = useCallback(() => {
    return api.get('/macrocategories').then(res => setMacrocategories(res.data))
  }, [])

  useEffect(() => { reloadTypes() }, [reloadTypes])
  useEffect(() => { reloadMacros() }, [reloadMacros])

  const typeMap = Object.fromEntries(expenseTypes.map(t => [t.name, t]))
  const typeNames = expenseTypes.map(t => t.name)
  const macroMap = Object.fromEntries(macrocategories.map(m => [m.id, m]))

  return (
    <ExpenseTypesContext.Provider value={{ expenseTypes, typeMap, typeNames, reloadTypes, macrocategories, macroMap, reloadMacros, loading }}>
      {children}
    </ExpenseTypesContext.Provider>
  )
}

export function useExpenseTypes() {
  return useContext(ExpenseTypesContext)
}
