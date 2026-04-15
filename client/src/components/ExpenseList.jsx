import { useState, useEffect, useRef } from 'react'
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
import Pagination from '@mui/material/Pagination'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import TableSortLabel from '@mui/material/TableSortLabel'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import RepeatIcon from '@mui/icons-material/Repeat'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import api from '../api.js'
import AddExpenseForm from './AddExpenseForm.jsx'
import AddIncomeForm from './AddIncomeForm.jsx'
import ImportDialog from './ImportDialog.jsx'
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

export default function ExpenseList({ refreshKey, onRefresh, month, activeType: propActiveType, onTypeChange, activeMacro, onMacroChange }) {
  const { typeNames, typeMap, macroMap } = useExpenseTypes()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  // Controlled when propActiveType is provided (home page); internal otherwise (all-expenses page)
  const [internalType, setInternalType] = useState('All')
  const activeType = propActiveType ?? internalType
  const handleTypeChange = onTypeChange ?? setInternalType
  const tabsRef = useRef(null)

  useEffect(() => {
    const root = tabsRef.current
    if (!root) return
    const scroller = root.querySelector('.MuiTabs-scroller')
    const selected = root.querySelector('[role="tab"][aria-selected="true"]')
    if (!scroller || !selected) return
    const sr = scroller.getBoundingClientRect()
    const er = selected.getBoundingClientRect()
    if (er.left < sr.left) {
      scroller.scrollLeft += er.left - sr.left - 8
    } else if (er.right > sr.right) {
      scroller.scrollLeft += er.right - sr.right + 8
    }
  }, [activeType])

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [editingIncome, setEditingIncome] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [detailIsIncome, setDetailIsIncome] = useState(false)

  const PAGE_SIZE = 50

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  useEffect(() => {
    setPage(1)
  }, [activeType, activeMacro, month, refreshKey, search, sortBy, sortDir])

  useEffect(() => {
    if (activeType === 'Income') {
      const params = { page, page_size: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir }
      if (month) params.month = month
      if (search) params.search = search
      api.get('/incomes', { params }).then(res => {
        setIncomes(res.data.incomes)
        setTotal(res.data.total)
      })
    } else {
      const params = { page, page_size: PAGE_SIZE, sort_by: sortBy, sort_dir: sortDir }
      if (activeMacro) {
        params.macrocategory_id = activeMacro
      } else if (activeType !== 'All') {
        params.type = activeType
      }
      if (month) params.month = month
      if (search) params.search = search
      api.get('/expenses', { params }).then(res => {
        setExpenses(res.data.expenses)
        setTotal(res.data.total)
      })
    }
  }, [refreshKey, activeType, activeMacro, month, page, search, sortBy, sortDir])

  async function handleDeleteExpense(id) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    try {
      await api.delete(`/expenses/${id}`)
      onRefresh()
    } catch {
      const params = { page, page_size: PAGE_SIZE }
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
      const params = { page, page_size: PAGE_SIZE }
      if (month) params.month = month
      api.get('/incomes', { params }).then(res => setIncomes(res.data.incomes))
    }
  }

  async function handleClearAll() {
    const params = month ? { month } : {}
    await api.delete('/transactions', { params })
    setShowClearConfirm(false)
    onRefresh()
  }

  const tabs = ['All', 'Income', ...typeNames.filter(n => n !== 'Income')]
  const isIncome = activeType === 'Income'
  const rows = isIncome ? incomes : expenses
  const isEmpty = rows.length === 0
  const pageCount = Math.ceil(total / PAGE_SIZE)
  const macroName = activeMacro ? (macroMap[activeMacro]?.name ?? '') : null

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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 }, pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {isIncome
            ? month ? `${formatMonthLabel(month)}'s Income` : 'All Income'
            : macroName
              ? month ? `${formatMonthLabel(month)} · ${macroName}` : macroName
              : month ? `${formatMonthLabel(month)}'s Expenses` : 'All Expenses'}
        </Typography>

        {/* Desktop header buttons (sm+) */}
        <Stack direction="row" gap={1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setShowClearConfirm(true)}
            sx={{ fontWeight: 600 }}
          >
            {month ? 'Clear Month' : 'Clear All'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setShowImport(true)}
            sx={{ fontWeight: 600 }}
          >
            Import
          </Button>
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

        {/* Mobile header buttons (xs only) */}
        <Stack direction="row" gap={0.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
          <Tooltip title={month ? 'Clear Month' : 'Clear All'}>
            <IconButton size="small" color="error" onClick={() => setShowClearConfirm(true)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Import">
            <IconButton size="small" onClick={() => setShowImport(true)} sx={{ color: 'text.secondary' }}>
              <UploadFileIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={isIncome ? 'Add Income' : 'Add Expense'}>
            <IconButton
              size="small"
              onClick={() => isIncome ? setShowIncomeForm(true) : setShowExpenseForm(true)}
              sx={{ color: isIncome ? INCOME_COLOR : 'primary.main' }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Type filter tabs */}
      <Box ref={tabsRef} sx={{ borderBottom: '1px solid rgba(240, 234, 214, 0.12)', px: 1 }}>
        <Tabs
          value={activeType}
          onChange={(_, val) => handleTypeChange(val)}
          variant="scrollable"
          scrollButtons={false}
          TabIndicatorProps={{
            style: {
              height: 2,
              backgroundColor:
                activeType === 'Income' ? INCOME_COLOR
                : activeType !== 'All' ? (typeMap[activeType]?.color ?? '#8fb996')
                : '#8fb996',
            },
          }}
          sx={{
            minHeight: 44,
            '& .MuiTab-root': { minHeight: 44, py: 0, fontSize: '0.9rem', color: 'text.secondary' },
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

      {/* Search */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(240,234,214,0.08)' }}>
        <TextField
          size="small"
          placeholder="Search by name…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                </InputAdornment>
              ),
              endAdornment: searchInput ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setSearchInput(''); setSearch('') }}>
                    <CloseIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              fontSize: '0.85rem',
              '& fieldset': { borderColor: 'rgba(240,234,214,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(240,234,214,0.3)' },
            },
          }}
        />
      </Box>

      {/* Content — mobile cards vs desktop table */}
      {isEmpty ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {isIncome
              ? 'No income recorded yet'
              : `No expenses${activeType !== 'All' ? ` in ${activeType}` : ''} yet`}
          </Typography>
        </Box>
      ) : isMobile ? (
        /* Mobile: tappable card list */
        <Box>
          {rows.map(row => (
            <Box
              key={row.id}
              onClick={() => { setDetailItem(row); setDetailIsIncome(isIncome) }}
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: '1px solid rgba(240,234,214,0.08)',
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: 'rgba(240,234,214,0.03)' },
                '&:active': { bgcolor: 'rgba(240,234,214,0.06)' },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0, flexShrink: 1 }}>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {row.name}
                  </Typography>
                  {row.is_recurring === 1 && <RepeatIcon sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />}
                </Stack>
                <Typography variant="body2" fontWeight={600} sx={{ color: isIncome ? INCOME_COLOR : typeMap[row.type]?.color || '#a0a0a0', flexShrink: 0 }}>
                  ${row.amount.toFixed(2)}
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
                <Chip
                  label={isIncome ? 'Income' : row.type}
                  variant="outlined"
                  size="small"
                  sx={{ color: isIncome ? INCOME_COLOR : typeMap[row.type]?.color || '#a0a0a0', borderColor: isIncome ? INCOME_COLOR : typeMap[row.type]?.color || '#a0a0a0', fontSize: '0.7rem', height: 20 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {formatDate(row.date)}
                </Typography>                                      
              </Stack>     
            </Box>
          ))}
        </Box>
      ) : (
        /* Desktop: sortable table */
        <TableContainer>
          <Table size="small" sx={{ minWidth: 480 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'name'}
                    direction={sortBy === 'name' ? sortDir : 'asc'}
                    onClick={() => handleSort('name')}
                    sx={{ color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'text.disabled !important' } }}
                  >
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  {isIncome ? 'Source' : 'Type'}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'date'}
                    direction={sortBy === 'date' ? sortDir : 'asc'}
                    onClick={() => handleSort('date')}
                    sx={{ color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'text.disabled !important' } }}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)', fontWeight: 600 }}>
                  <TableSortLabel
                    active={sortBy === 'amount'}
                    direction={sortBy === 'amount' ? sortDir : 'asc'}
                    onClick={() => handleSort('amount')}
                    sx={{ color: 'inherit !important', '& .MuiTableSortLabel-icon': { color: 'text.disabled !important' }, flexDirection: 'row-reverse' }}
                  >
                    Amount
                  </TableSortLabel>
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
                    <TableCell align="right" sx={{ color: isIncome ? INCOME_COLOR : typeMap[e.type]?.color || 'text.primary', fontWeight: 500 }}>
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

      {pageCount > 1 && (
        <Stack alignItems="center" sx={{ py: 2 }}>
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
            sx={{ '& .MuiPaginationItem-root': { color: 'text.secondary' } }}
          />
        </Stack>
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
      {showImport && (
        <ImportDialog
          defaultRecordType={isIncome ? 'income' : 'expense'}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); onRefresh() }}
        />
      )}

      {/* Clear confirmation dialog */}
      <Dialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)' } }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: 'text.primary' }}>
          {month ? `Clear ${formatMonthLabel(month)}?` : 'Clear all transactions?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {month
              ? `This will permanently delete all expenses and income for ${formatMonthLabel(month)}. This cannot be undone.`
              : 'This will permanently delete all expenses and income records. This cannot be undone.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="text" color="inherit" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleClearAll}>
            {month ? 'Delete Month' : 'Delete Everything'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transaction detail modal (mobile) */}
      <Dialog
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)' } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {detailItem?.name}
            </Typography>
            <IconButton size="small" onClick={() => setDetailItem(null)} sx={{ color: 'text.secondary' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(240,234,214,0.12)' }} />
        <DialogContent sx={{ pt: 2 }}>
          <Stack gap={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">Amount</Typography>
              <Typography variant="body1" fontWeight={600}
                sx={{ color: detailIsIncome ? INCOME_COLOR : 'text.primary' }}>
                ${detailItem?.amount?.toFixed(2)}
              </Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">Type</Typography>
              {detailIsIncome ? (
                <Chip label="Income" variant="outlined" size="small"
                  sx={{ color: INCOME_COLOR, borderColor: INCOME_COLOR, fontSize: '0.75rem', height: 22 }} />
              ) : (
                <Chip
                  label={detailItem?.type}
                  variant="outlined"
                  size="small"
                  sx={{
                    color: typeMap[detailItem?.type]?.color || '#a0a0a0',
                    borderColor: typeMap[detailItem?.type]?.color || '#a0a0a0',
                    fontSize: '0.75rem',
                    height: 22,
                  }}
                />
              )}
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">Date</Typography>
              <Typography variant="body2" color="text.primary">
                {detailItem?.date ? formatDate(detailItem.date) : ''}
              </Typography>
            </Stack>
            {detailItem?.is_recurring === 1 && (
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">Recurring</Typography>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <RepeatIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">Monthly</Typography>
                </Stack>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <Divider sx={{ borderColor: 'rgba(240,234,214,0.12)' }} />
        <DialogActions sx={{ px: 2, py: 1.5, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => {
              if (detailIsIncome) handleDeleteIncome(detailItem.id)
              else handleDeleteExpense(detailItem.id)
              setDetailItem(null)
            }}
          >
            Delete
          </Button>
          <Button
            variant="contained"
            startIcon={<EditOutlinedIcon />}
            onClick={() => {
              if (detailIsIncome) setEditingIncome(detailItem)
              else setEditingExpense(detailItem)
              setDetailItem(null)
            }}
            sx={detailIsIncome ? { bgcolor: INCOME_COLOR, '&:hover': { bgcolor: '#5fa8a2' } } : {}}
          >
            Edit
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
