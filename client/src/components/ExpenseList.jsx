import { useState, useEffect, useRef } from 'react'
import { startTransition } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { qk } from '../queryKeys.js'
import { Plus, Trash2, Pencil, Repeat, Upload, Search, X, ArrowUp, ArrowDown, TriangleAlert } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import api from '../api.js'
import AddExpenseForm from './AddExpenseForm.jsx'
import AddIncomeForm from './AddIncomeForm.jsx'
import ImportDialog from './ImportDialog.jsx'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { useC } from '../colors'
import { Card } from 'glasscn-ui'

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-')
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function formatMonthLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long' })
}

function SortBtn({ col, sortBy, sortDir, onSort, children, className = '' }) {
  const C = useC()
  const active = sortBy === col
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 bg-transparent border-none cursor-pointer font-[inherit] font-semibold text-xs ${className}`}
      style={{ color: C.muted }}
    >
      {children}
      <span style={{ viewTransitionName: `sort-arrow-${col}`, display: 'inline-flex' }}>
        {active
          ? (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
          : <ArrowDown size={12} style={{ opacity: 0.3 }} />}
      </span>
    </button>
  )
}

export default function ExpenseList({ month, activeType: propActiveType, onTypeChange, activeMacro, onMacroChange, initialType, initialHighlightId, initialMonth, onInitialTypeConsumed }) {
  const C = useC()
  const queryClient = useQueryClient()
  const { typeNames, typeMap, macroMap } = useExpenseTypes()

  const [internalType, setInternalType] = useState(initialType ?? 'All')
  const activeType = propActiveType ?? internalType
  const handleTypeChange = onTypeChange ?? setInternalType
  const [highlightId, setHighlightId] = useState(initialHighlightId ?? null)
  const [internalMonth] = useState(initialMonth ?? null)
  const effectiveMonth = month ?? internalMonth

  useEffect(() => {
    onInitialTypeConsumed?.()
  }, [])

  const tabsRef = useRef(null)

  useEffect(() => {
    const container = tabsRef.current
    if (!container) return
    const active = container.querySelector('[data-active="true"]')
    if (!active) return
    const cr = container.getBoundingClientRect()
    const er = active.getBoundingClientRect()
    if (er.left < cr.left) container.scrollLeft += er.left - cr.left - 8
    else if (er.right > cr.right) container.scrollLeft += er.right - cr.right + 8
  }, [activeType])

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!highlightId) return
    const frame = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-expense-id="${highlightId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    const t = setTimeout(() => setHighlightId(null), 5000)
    return () => { cancelAnimationFrame(frame); clearTimeout(t) }
  }, [highlightId])
  const [page, setPage] = useState(1)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [editingIncome, setEditingIncome] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [detailIsIncome, setDetailIsIncome] = useState(false)

  const [outlierMonths] = useState(() => parseInt(localStorage.getItem('budget_history_months'), 10) || 6)
  const { data: outliersRaw } = useQuery({
    queryKey: qk.analysisOutliers(outlierMonths),
    queryFn: () => api.get('/analysis/outliers', { params: { months: outlierMonths } }).then(r => r.data ?? []),
    staleTime: 3 * 60_000,
  })
  const [outlierIds, setOutlierIds] = useState(() => new Set())
  useEffect(() => {
    if (!outliersRaw) return
    const dismissed = (() => {
      try { return new Set(JSON.parse(localStorage.getItem('budget_dismissed_outliers') ?? '[]')) }
      catch { return new Set() }
    })()
    setOutlierIds(new Set(outliersRaw.map(o => o.id).filter(id => !dismissed.has(id))))
  }, [outliersRaw])

  function handleDismissOutlier(id) {
    setOutlierIds(prev => { const next = new Set(prev); next.delete(id); return next })
    try {
      const prev = new Set(JSON.parse(localStorage.getItem('budget_dismissed_outliers') ?? '[]'))
      prev.add(id)
      localStorage.setItem('budget_dismissed_outliers', JSON.stringify([...prev]))
    } catch {}
  }

  const PAGE_SIZE = 50

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  function handleSort(col) {
    const update = () => {
      if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else { setSortBy(col); setSortDir('asc') }
    }
    if (document.startViewTransition) {
      document.startViewTransition(() => startTransition(update)).finished.catch(() => {})
    } else {
      startTransition(update)
    }
  }

  useEffect(() => { setPage(1) }, [activeType, activeMacro, effectiveMonth, search, sortBy, sortDir])

  const incomeParams = activeType === 'Income' ? {
    page, page_size: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir,
    ...(effectiveMonth ? { month: effectiveMonth } : {}),
    ...(search ? { search } : {}),
  } : null

  const expenseParams = activeType !== 'Income' ? {
    page, page_size: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir,
    ...(activeMacro ? { macrocategory_id: activeMacro } : activeType !== 'All' ? { type: activeType } : {}),
    ...(effectiveMonth ? { month: effectiveMonth } : {}),
    ...(search ? { search } : {}),
  } : null

  const { data: incomesResult, isPlaceholderData: incomesPlaceholder } = useQuery({
    queryKey: qk.incomes(incomeParams),
    queryFn: () => api.get('/incomes', { params: incomeParams }).then(r => r.data),
    enabled: activeType === 'Income',
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const incomes = incomesResult?.incomes ?? []

  const { data: expensesResult, isPlaceholderData: expensesPlaceholder } = useQuery({
    queryKey: qk.expenses(expenseParams),
    queryFn: () => api.get('/expenses', { params: expenseParams }).then(r => r.data),
    enabled: activeType !== 'Income',
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const expenses = expensesResult?.expenses ?? []

  useEffect(() => {
    if (activeType === 'Income' && incomesResult) setTotal(incomesResult.total)
    else if (activeType !== 'Income' && expensesResult) setTotal(expensesResult.total)
  }, [activeType, incomesResult, expensesResult])

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['expenses'] })
    queryClient.invalidateQueries({ queryKey: ['incomes'] })
    queryClient.invalidateQueries({ queryKey: ['analysis'] })
  }

  async function handleDeleteExpense(id) {
    try {
      await api.delete(`/expenses/${id}`)
      invalidateAll()
    } catch { invalidateAll() }
  }

  async function handleDeleteIncome(id) {
    try {
      await api.delete(`/incomes/${id}`)
      invalidateAll()
    } catch { invalidateAll() }
  }

  async function handleClearAll() {
    const params = effectiveMonth ? { month: effectiveMonth } : {}
    await api.delete('/transactions', { params })
    setShowClearConfirm(false)
    invalidateAll()
  }

  const tabs = ['All', 'Income', ...typeNames.filter(n => n !== 'Income')]
  const isIncome = activeType === 'Income'
  const rows = isIncome ? incomes : expenses
  const isEmpty = rows.length === 0
  const pageCount = Math.ceil(total / PAGE_SIZE)
  const macroName = activeMacro ? (macroMap[activeMacro]?.name ?? '') : null

  const activeTabColor = activeType === 'Income' ? C.income
    : activeType !== 'All' ? (typeMap[activeType]?.color ?? C.primary)
    : C.primary

  return (
    <Card variant="glass" blur="xl" className="rounded-xl overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-5 pb-3">
        <h2 className="text-base font-semibold" style={{ color: C.warmText }}>
          {isIncome
            ? effectiveMonth ? `${formatMonthLabel(effectiveMonth)}'s Income` : 'All Income'
            : macroName
              ? effectiveMonth ? `${formatMonthLabel(effectiveMonth)} · ${macroName}` : macroName
              : effectiveMonth ? `${formatMonthLabel(effectiveMonth)}'s Expenses` : 'All Expenses'}
        </h2>

        {/* Desktop buttons */}
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)}
            className="font-semibold text-red-500 border-red-400 hover:bg-red-50 dark:hover:bg-red-950">
            {effectiveMonth ? 'Clear Month' : 'Clear All'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="font-semibold">
            <Upload size={14} className="mr-1" />Import
          </Button>
          {isIncome ? (
            <Button size="sm" className="font-semibold" onClick={() => setShowIncomeForm(true)}
              style={{ backgroundColor: C.income, color: '#000' }}>
              <Plus size={14} className="mr-1" />Add Income
            </Button>
          ) : (
            <Button size="sm" className="font-semibold" onClick={() => setShowExpenseForm(true)}>
              <Plus size={14} className="mr-1" />Add Expense
            </Button>
          )}
        </div>

        {/* Mobile buttons */}
        <div className="flex sm:hidden gap-1">
          <button type="button" title={month ? 'Clear Month' : 'Clear All'}
            onClick={() => setShowClearConfirm(true)}
            className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer"
            style={{ color: C.overBudget }}>
            <Trash2 size={16} />
          </button>
          <button type="button" title="Import" onClick={() => setShowImport(true)}
            className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer"
            style={{ color: C.muted }}>
            <Upload size={16} />
          </button>
          <button type="button" title={isIncome ? 'Add Income' : 'Add Expense'}
            onClick={() => isIncome ? setShowIncomeForm(true) : setShowExpenseForm(true)}
            className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer"
            style={{ color: isIncome ? C.income : C.primary }}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable type tabs */}
      <div
        ref={tabsRef}
        className="flex overflow-x-auto px-1 scrollbar-none"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        {tabs.map(tab => {
          const isActive = activeType === tab
          const tabColor = tab === 'Income' ? C.income
            : tab !== 'All' ? (typeMap[tab]?.color ?? C.primary)
            : C.primary
          return (
            <button
              key={tab}
              type="button"
              data-active={isActive}
              onClick={() => handleTypeChange(tab)}
              className="px-3 py-2.5 text-sm whitespace-nowrap bg-transparent border-none cursor-pointer font-[inherit] flex-shrink-0 border-b-2 transition-colors duration-150 rounded-lg"
              style={{
                color: isActive ? tabColor : C.muted,
                borderBottomColor: isActive ? tabColor : 'transparent',
                '--hover-tint': `${tabColor}22`,
              }}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="px-3 py-2" style={{ borderBottom: `1px solid ${C.hoverStrong}` }}>
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.dimText }} />
          <Input
            placeholder="Search by name…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-8 pr-8 text-sm h-8"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearch('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0"
              style={{ color: C.dimText }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="py-10 text-center">
          <p className="text-sm" style={{ color: C.muted }}>
            {isIncome ? 'No income recorded yet' : `No expenses${activeType !== 'All' ? ` in ${activeType}` : ''} yet`}
          </p>
        </div>
      )}

      {/* Mobile card list */}
      {!isEmpty && (
        <div className="sm:hidden">
          {rows.map(row => {
            const isHighlighted = !isIncome && highlightId === row.id
            return (
            <div
              key={row.id}
              data-expense-id={row.id}
              onClick={() => { setDetailItem(row); setDetailIsIncome(isIncome) }}
              className="px-4 py-3 cursor-pointer select-none"
              style={{
                borderBottom: `1px solid ${C.hoverStrong}`,
                backgroundColor: isHighlighted ? `${C.primary}18` : 'transparent',
                outline: isHighlighted ? `2px solid ${C.primary}55` : 'none',
                outlineOffset: '-2px',
                transition: 'background-color 0.5s, outline 0.5s',
              }}
              onMouseEnter={e => { if (!isHighlighted) e.currentTarget.style.backgroundColor = !isIncome && typeMap[row.type]?.color ? `${C.adaptColor(typeMap[row.type].color)}14` : C.subtleBg }}
              onMouseLeave={e => { if (!isHighlighted) e.currentTarget.style.backgroundColor = isHighlighted ? `${C.primary}18` : 'transparent' }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-shrink">
                  <span className="text-sm font-semibold truncate" style={{ color: C.warmText }}>{row.name}</span>
                  {row.is_recurring === 1 && <Repeat size={12} style={{ color: C.muted, flexShrink: 0 }} />}
                  {!isIncome && outlierIds.has(row.id) && (
                    <button type="button" title="Unusual expense — click to dismiss flag"
                      onClick={ev => { ev.stopPropagation(); handleDismissOutlier(row.id) }}
                      className="bg-transparent border-none cursor-pointer p-0 flex-shrink-0"
                      style={{ color: C.atRisk, lineHeight: 0 }}>
                      <TriangleAlert size={12} />
                    </button>
                  )}
                </div>
                <span className="text-sm font-semibold flex-shrink-0"
                  style={{ color: isIncome ? C.income : typeMap[row.type]?.color || C.dimText }}>
                  ${row.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <button
                  type="button"
                  onClick={ev => { ev.stopPropagation(); if (!isIncome) handleTypeChange(row.type) }}
                  className="text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap bg-transparent font-[inherit] transition-opacity duration-150 hover:opacity-70"
                  style={{
                    color: isIncome ? C.income : C.adaptColor(typeMap[row.type]?.color || C.dimText),
                    borderColor: isIncome ? C.income : C.adaptColor(typeMap[row.type]?.color || C.dimText),
                    cursor: isIncome ? 'default' : 'pointer',
                  }}
                >
                  {isIncome ? 'Income' : row.type}
                </button>
                <span className="text-xs" style={{ color: C.muted }}>{formatDate(row.date)}</span>
              </div>
            </div>
          )})}
        </div>
      )}

      {/* Desktop table */}
      {!isEmpty && (
        <div className="hidden sm:block" style={{ minHeight: 240 }}>
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: C.hoverStrong }}>
                <TableHead style={{ color: C.muted }}>
                  <SortBtn col="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>Name</SortBtn>
                </TableHead>
                <TableHead style={{ color: C.muted }}>{isIncome ? 'Source' : 'Type'}</TableHead>
                <TableHead style={{ color: C.muted }}>
                  <SortBtn col="date" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>Date</SortBtn>
                </TableHead>
                <TableHead className="text-right" style={{ color: C.muted }}>
                  <SortBtn col="amount" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="ml-auto">Amount</SortBtn>
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isIncome
                ? incomes.map(inc => (
                  <TableRow key={inc.id} style={{ borderColor: C.hoverStrong, viewTransitionName: `row-inc-${inc.id}` }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = `${C.income}14`}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <TableCell className="max-w-0 w-full" style={{ color: C.warmText }}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{inc.name}</span>
                        {inc.is_recurring === 1 && <Repeat size={13} className="flex-shrink-0" style={{ color: C.muted, opacity: 0.7 }} title="Recurring monthly income" />}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {inc.credit_type ? (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap"
                          style={{ color: C.nearGoal, borderColor: C.nearGoal }}>
                          Credit → {inc.credit_type}
                        </span>
                      ) : (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap"
                          style={{ color: C.income, borderColor: C.income }}>
                          Income
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap" style={{ color: C.muted }}>{formatDate(inc.date)}</TableCell>
                    <TableCell className="text-right font-medium" style={{ color: C.income }}>${inc.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-0.5">
                        <button type="button" title="Edit income" onClick={() => setEditingIncome(inc)}
                          className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150"
                          style={{ color: C.muted }}
                          onMouseEnter={e => e.currentTarget.style.color = C.primary}
                          onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" title="Delete income" onClick={() => handleDeleteIncome(inc.id)}
                          className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150"
                          style={{ color: C.muted }}
                          onMouseEnter={e => e.currentTarget.style.color = C.overBudget}
                          onMouseLeave={e => e.currentTarget.style.color = C.muted}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
                : expenses.map(e => {
                  const isHighlighted = highlightId === e.id
                  return (
                  <TableRow
                    key={e.id}
                    data-expense-id={e.id}
                    style={{
                      borderColor: C.hoverStrong,
                      viewTransitionName: `row-exp-${e.id}`,
                      backgroundColor: isHighlighted ? `${C.primary}18` : 'transparent',
                      outline: isHighlighted ? `2px solid ${C.primary}55` : 'none',
                      outlineOffset: '-2px',
                      transition: 'background-color 0.5s, outline 0.5s',
                    }}
                    onMouseEnter={ev => { if (!isHighlighted) ev.currentTarget.style.backgroundColor = typeMap[e.type]?.color ? `${C.adaptColor(typeMap[e.type].color)}14` : C.subtleBg }}
                    onMouseLeave={ev => { if (!isHighlighted) ev.currentTarget.style.backgroundColor = 'transparent' }}>
                    <TableCell className="max-w-0 w-full" style={{ color: C.warmText }}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{e.name}</span>
                        {e.is_recurring === 1 && <Repeat size={13} className="flex-shrink-0" style={{ color: C.muted, opacity: 0.7 }} title="Recurring monthly expense" />}
                        {outlierIds.has(e.id) && (
                          <button type="button" title="Unusual expense — click to dismiss flag"
                            onClick={ev => { ev.stopPropagation(); handleDismissOutlier(e.id) }}
                            className="bg-transparent border-none cursor-pointer p-0 flex-shrink-0"
                            style={{ color: C.atRisk, lineHeight: 0 }}>
                            <TriangleAlert size={13} />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <button
                        type="button"
                        onClick={ev => { ev.stopPropagation(); handleTypeChange(e.type) }}
                        className="text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap bg-transparent cursor-pointer font-[inherit] transition-opacity duration-150 hover:opacity-70"
                        style={{ color: C.adaptColor(typeMap[e.type]?.color || C.dimText), borderColor: C.adaptColor(typeMap[e.type]?.color || C.dimText) }}>
                        {e.type}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap" style={{ color: C.muted }}>{formatDate(e.date)}</TableCell>
                    <TableCell className="text-right font-medium"
                      style={{ color: C.adaptColor(typeMap[e.type]?.color || C.warmText) }}>
                      ${e.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-0.5">
                        <button type="button" title="Edit expense" onClick={() => setEditingExpense(e)}
                          className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150"
                          style={{ color: C.muted }}
                          onMouseEnter={ev => ev.currentTarget.style.color = C.primary}
                          onMouseLeave={ev => ev.currentTarget.style.color = C.muted}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" title="Delete expense" onClick={() => handleDeleteExpense(e.id)}
                          className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150"
                          style={{ color: C.muted }}
                          onMouseEnter={ev => ev.currentTarget.style.color = C.overBudget}
                          onMouseLeave={ev => ev.currentTarget.style.color = C.muted}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})
              }
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 py-3">
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 rounded-lg text-sm bg-transparent border-none cursor-pointer disabled:opacity-40"
            style={{ color: C.muted }}>
            ← Prev
          </button>
          <span className="text-sm" style={{ color: C.muted }}>Page {page} of {pageCount}</span>
          <button type="button" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
            className="px-3 py-1 rounded-lg text-sm bg-transparent border-none cursor-pointer disabled:opacity-40"
            style={{ color: C.muted }}>
            Next →
          </button>
        </div>
      )}

      {/* Forms & dialogs */}
      {showExpenseForm && <AddExpenseForm onClose={() => setShowExpenseForm(false)} />}
      {editingExpense && <AddExpenseForm expense={editingExpense} onClose={() => setEditingExpense(null)} />}
      {showIncomeForm && <AddIncomeForm onClose={() => setShowIncomeForm(false)} />}
      {editingIncome && <AddIncomeForm income={editingIncome} onClose={() => setEditingIncome(null)} />}
      {showImport && (
        <ImportDialog
          defaultRecordType={isIncome ? 'income' : 'expense'}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); invalidateAll() }}
        />
      )}

      {/* Clear confirm */}
      <Dialog open={showClearConfirm} onOpenChange={open => { if (!open) setShowClearConfirm(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{effectiveMonth ? `Clear ${formatMonthLabel(effectiveMonth)}?` : 'Clear all transactions?'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {effectiveMonth
              ? `This will permanently delete all expenses and income for ${formatMonthLabel(effectiveMonth)}. This cannot be undone.`
              : 'This will permanently delete all expenses and income records. This cannot be undone.'}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClearAll}>
              {month ? 'Delete Month' : 'Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile detail */}
      <Dialog open={!!detailItem} onOpenChange={open => { if (!open) setDetailItem(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{detailItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Amount</span>
              <span className="text-sm font-semibold"
                style={{ color: detailIsIncome ? 'var(--income, green)' : 'var(--foreground)' }}>
                ${detailItem?.amount?.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Type</span>
              <button
                type="button"
                onClick={() => {
                  if (!detailIsIncome) { setDetailItem(null); handleTypeChange(detailItem.type) }
                }}
                className="text-[11px] px-1.5 py-0.5 rounded-full border whitespace-nowrap bg-transparent font-[inherit] transition-opacity duration-150"
                style={{
                  color: detailIsIncome ? 'var(--income)' : typeMap[detailItem?.type]?.color || 'var(--muted-foreground)',
                  borderColor: detailIsIncome ? 'var(--income)' : typeMap[detailItem?.type]?.color || 'var(--muted-foreground)',
                  cursor: detailIsIncome ? 'default' : 'pointer',
                }}>
                {detailIsIncome ? 'Income' : detailItem?.type}
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Date</span>
              <span className="text-sm">{detailItem?.date ? formatDate(detailItem.date) : ''}</span>
            </div>
            {detailItem?.is_recurring === 1 && (
              <div className="flex justify-between items-center">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Recurring</span>
                <div className="flex items-center gap-1.5">
                  <Repeat size={13} style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Monthly</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="justify-between">
            <Button variant="outline" className="text-red-500 border-red-400" onClick={() => {
              if (detailIsIncome) handleDeleteIncome(detailItem.id)
              else handleDeleteExpense(detailItem.id)
              setDetailItem(null)
            }}>
              <Trash2 size={14} className="mr-1" />Delete
            </Button>
            <Button onClick={() => {
              if (detailIsIncome) setEditingIncome(detailItem)
              else setEditingExpense(detailItem)
              setDetailItem(null)
            }}>
              <Pencil size={14} className="mr-1" />Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
