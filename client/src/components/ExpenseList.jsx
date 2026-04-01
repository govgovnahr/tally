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
import { TYPE_NAMES, TYPE_MAP } from '../expenseTypes.js'

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
  const [editingExpense, setEditingExpense] = useState(null)

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

  const tabs = ['All', ...TYPE_NAMES]

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
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 3, pt: 3, pb: 2 }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
          Expenses
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setShowForm(true)}
          sx={{ fontWeight: 600 }}
        >
          Add Expense
        </Button>
      </Stack>

      {/* Type filter tabs */}
      <Box sx={{ borderBottom: '1px solid rgba(240, 234, 214, 0.12)', px: 1 }}>
        <Tabs
          value={activeType}
          onChange={(_, val) => setActiveType(val)}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ style: { height: 2 } }}
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40,
              py: 0,
              fontSize: '0.85rem',
              color: 'text.secondary',
            },
          }}
        >
          {tabs.map(tab => (
            <Tab
              key={tab}
              label={tab}
              value={tab}
              sx={
                activeType === tab && tab !== 'All'
                  ? { color: `${TYPE_MAP[tab]?.color} !important` }
                  : activeType === tab
                  ? { color: 'primary.main !important' }
                  : {}
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Content */}
      {expenses.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No expenses {activeType !== 'All' ? `in ${activeType}` : 'yet'}
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
                  Type
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  Date
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}
                >
                  Amount
                </TableCell>
                <TableCell sx={{ borderColor: 'rgba(240,234,214,0.08)', width: 80 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map(e => (
                <TableRow
                  key={e.id}
                  sx={{
                    '&:hover': { bgcolor: 'rgba(240,234,214,0.03)' },
                    '& td': { borderColor: 'rgba(240,234,214,0.08)' },
                  }}
                >
                  <TableCell sx={{ color: 'text.primary' }}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      {e.name}
                      {e.is_recurring === 1 && (
                        <RepeatIcon
                          sx={{ fontSize: 14, color: 'text.secondary', opacity: 0.7 }}
                          titleAccess="Recurring monthly expense"
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={e.type}
                      variant="outlined"
                      size="small"
                      sx={{
                        color: TYPE_MAP[e.type]?.color || '#a0a0a0',
                        borderColor: TYPE_MAP[e.type]?.color || '#a0a0a0',
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
                      <IconButton
                        size="small"
                        onClick={() => setEditingExpense(e)}
                        title="Edit expense"
                        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(e.id)}
                        title="Delete expense"
                        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {showForm && (
        <AddExpenseForm
          onClose={() => setShowForm(false)}
          onAdded={handleAdded}
        />
      )}
      {editingExpense && (
        <AddExpenseForm
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onAdded={handleAdded}
        />
      )}
    </Paper>
  )
}
