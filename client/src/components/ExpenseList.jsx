import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Stack from '@mui/material/Stack'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import RepeatIcon from '@mui/icons-material/Repeat'
import api from '../api.js'
import AddExpenseForm from './AddExpenseForm.jsx'
import AddIncomeForm from './AddIncomeForm.jsx'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'

const INCOME_COLOR = '#80cbc4'

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

export default function ExpenseList({ refreshKey, onRefresh, month, activeType: propActiveType, onTypeChange }) {
  const { typeNames, typeMap } = useExpenseTypes()

  // Controlled when propActiveType is provided (home page); internal otherwise (all-expenses page)
  const [internalType, setInternalType] = useState('All')
  const activeType = propActiveType ?? internalType
  const handleTypeChange = onTypeChange ?? setInternalType

  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [editingIncome, setEditingIncome] = useState(null)

  useEffect(() => {
    if (activeType === 'Income') {
      const params = {}
      if (month) params.month = month
      api.get('/incomes', { params }).then(res => setIncomes(res.data.incomes))
    } else {
      const params = {}
      if (activeType !== 'All') params.type = activeType
      if (month) params.month = month
      api.get('/expenses', { params }).then(res => setExpenses(res.data.expenses))
    }
  }, [refreshKey, activeType, month])

  async function handleDeleteExpense(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    try {
      await api.delete(`/expenses/${id}`)
      onRefresh()
    } catch {
      const params = {}
      if (activeType !== 'All') params.type = activeType
      if (month) params.month = month
      api.get('/expenses', { params }).then(res => setExpenses(res.data.expenses))
    }
  }

  async function handleDeleteIncome(id) {
    setIncomes(prev => prev.filter(i => i.id !== id))
    try {
      await api.delete(`/incomes/${id}`)
      onRefresh()
    } catch {
      const params = {}
      if (month) params.month = month
      api.get('/incomes', { params }).then(res => setIncomes(res.data.incomes))
    }
  }

  const tabs = ['All', ...typeNames, 'Income']
  const isIncome = activeType === 'Income'
  const rows = isIncome ? incomes : expenses
  const isEmpty = rows.length === 0

  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid rgba(240, 234, 214, 0.12)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, pt: 3, pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {isIncome ? month ? `${formatMonthLabel(month)}'s Income` : 'All Income' : month ? `${formatMonthLabel(month)}'s Expenses` : 'All Expenses'}
        </Typography>
        <Stack direction="row" gap={1}>
          {isIncome ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setShowIncomeForm(true)}
              sx={{ fontWeight: 600, bgcolor: INCOME_COLOR, '&:hover': { bgcolor: '#5fa8a2' } }}
            >
              Add Income
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setShowExpenseForm(true)}
              sx={{ fontWeight: 600 }}
            >
              Add Expense
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Type filter tabs */}
      <Box sx={{ borderBottom: '1px solid rgba(240, 234, 214, 0.12)', px: 1 }}>
        <Tabs
          value={activeType}
          onChange={(_, val) => handleTypeChange(val)}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ style: { height: 2 } }}
          sx={{
            minHeight: 40,
            '& .MuiTab-root': { minHeight: 40, py: 0, fontSize: '0.85rem', color: 'text.secondary' },
          }}
        >
          {tabs.map(tab => (
            <Tab
              key={tab}
              label={tab}
              value={tab}
              sx={
                activeType === tab && tab === 'Income'
                  ? { color: `${INCOME_COLOR} !important` }
                  : activeType === tab && tab !== 'All'
                  ? { color: `${typeMap[tab]?.color} !important` }
                  : activeType === tab
                  ? { color: 'primary.main !important' }
                  : {}
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Content */}
      {isEmpty ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {isIncome
              ? 'No income recorded yet'
              : `No expenses${activeType !== 'All' ? ` in ${activeType}` : ''} yet`}
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  Name
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  {isIncome ? 'Source' : 'Type'}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  Date
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  Amount
                </TableCell>
                <TableCell sx={{ borderColor: 'rgba(240,234,214,0.08)', width: 80 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isIncome
                ? incomes.map(inc => (
                  <TableRow
                    key={inc.id}
                    sx={{ '&:hover': { bgcolor: 'rgba(240,234,214,0.03)' }, '& td': { borderColor: 'rgba(240,234,214,0.08)' } }}
                  >
                    <TableCell sx={{ color: 'text.primary' }}>
                      <Stack direction="row" alignItems="center" gap={0.75}>
                        {inc.name}
                        {inc.is_recurring === 1 && (
                          <RepeatIcon sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7 }} titleAccess="Recurring monthly income" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label="Income"
                        variant="outlined"
                        size="small"
                        sx={{ color: INCOME_COLOR, borderColor: INCOME_COLOR, fontSize: '0.75rem', height: 22 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {formatDate(inc.date)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: INCOME_COLOR, fontWeight: 500 }}>
                      ${inc.amount.toFixed(2)}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" justifyContent="center">
                        <IconButton size="small" onClick={() => setEditingIncome(inc)} title="Edit income"
                          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteIncome(inc.id)} title="Delete income"
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
                : expenses.map(e => (
                  <TableRow
                    key={e.id}
                    sx={{ '&:hover': { bgcolor: 'rgba(240,234,214,0.03)' }, '& td': { borderColor: 'rgba(240,234,214,0.08)' } }}
                  >
                    <TableCell sx={{ color: 'text.primary' }}>
                      <Stack direction="row" alignItems="center" gap={0.75}>
                        {e.name}
                        {e.is_recurring === 1 && (
                          <RepeatIcon sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7 }} titleAccess="Recurring monthly expense" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={e.type}
                        variant="outlined"
                        size="small"
                        sx={{
                          color: typeMap[e.type]?.color || '#a0a0a0',
                          borderColor: typeMap[e.type]?.color || '#a0a0a0',
                          fontSize: '0.75rem',
                          height: 22,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {formatDate(e.date)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.primary', fontWeight: 500 }}>
                      ${e.amount.toFixed(2)}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" justifyContent="center">
                        <IconButton size="small" onClick={() => setEditingExpense(e)} title="Edit expense"
                          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteExpense(e.id)} title="Delete expense"
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {showExpenseForm && (
        <AddExpenseForm onClose={() => setShowExpenseForm(false)} onAdded={onRefresh} />
      )}
      {editingExpense && (
        <AddExpenseForm expense={editingExpense} onClose={() => setEditingExpense(null)} onAdded={onRefresh} />
      )}
      {showIncomeForm && (
        <AddIncomeForm onClose={() => setShowIncomeForm(false)} onAdded={() => { setShowIncomeForm(false); onRefresh() }} />
      )}
      {editingIncome && (
        <AddIncomeForm income={editingIncome} onClose={() => setEditingIncome(null)} onAdded={() => { setEditingIncome(null); onRefresh() }} />
      )}
    </Paper>
  )
}
