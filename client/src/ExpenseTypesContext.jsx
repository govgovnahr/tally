import { createContext, useContext } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from './api.js'
import { qk } from './queryKeys.js'

const ExpenseTypesContext = createContext(null)

export function ExpenseTypesProvider({ children }) {
  const queryClient = useQueryClient()

  const { data: expenseTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: qk.expenseTypes(),
    queryFn: () => api.get('/expense-types').then(r => [...r.data].sort((a, b) => a.name.localeCompare(b.name))),
    staleTime: 10 * 60_000,
  })

  const { data: macrocategories = [] } = useQuery({
    queryKey: qk.macrocategories(),
    queryFn: () => api.get('/macrocategories').then(r => r.data),
    staleTime: 10 * 60_000,
  })

  const reloadTypes = () => queryClient.invalidateQueries({ queryKey: qk.expenseTypes() })
  const reloadMacros = () => queryClient.invalidateQueries({ queryKey: qk.macrocategories() })

  const typeMap = Object.fromEntries(expenseTypes.map(t => [t.name, t]))
  const typeNames = expenseTypes.map(t => t.name)
  const macroMap = Object.fromEntries(macrocategories.map(m => [m.id, m]))

  return (
    <ExpenseTypesContext.Provider value={{ expenseTypes, typeMap, typeNames, reloadTypes, macrocategories, macroMap, reloadMacros, loading: typesLoading }}>
      {children}
    </ExpenseTypesContext.Provider>
  )
}

export function useExpenseTypes() {
  return useContext(ExpenseTypesContext)
}
