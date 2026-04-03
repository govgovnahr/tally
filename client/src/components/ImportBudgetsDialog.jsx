import { useState, useRef } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import api from '../api.js'

const FIELDS = [
  { key: 'category',      label: 'Category',      required: true,  hint: 'The expense category name' },
  { key: 'monthly_limit', label: 'Monthly Limit',  required: true,  hint: 'Budget amount (multiple rows for the same category will be summed)' },
  { key: 'month',         label: 'Month',          required: false, hint: 'Optional — YYYY-MM or date. If set, saves as a monthly override instead of the default' },
]

function autoMap(headers) {
  const result = {}
  for (const field of FIELDS) {
    const match = headers.find(h => {
      const hl = h.toLowerCase().replace(/[^a-z]/g, '')
      if (field.key === 'category') return hl.includes('categ') || hl.includes('type') || hl.includes('name') || hl === 'category'
      if (field.key === 'monthly_limit') return hl.includes('limit') || hl.includes('budget') || hl.includes('amount')
      if (field.key === 'month') return hl === 'month' || hl.includes('month')
      return false
    })
    result[field.key] = match ?? ''
  }
  return result
}

function monthsAhead(count) {
  const result = [{ key: '', label: 'Default (no specific month)' }]
  const now = new Date()
  let y = now.getFullYear(), m = now.getMonth() - 1  // start 2 months back
  if (m <= 0) { m += 12; y -= 1 }
  for (let i = 0; i <= count + 2; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const label = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    result.push({ key, label })
    if (++m > 12) { m = 1; y++ }
  }
  return result
}

const SELECTABLE_MONTHS = monthsAhead(12)

export default function ImportBudgetsDialog({ onClose, onImported }) {
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [headerRow, setHeaderRow] = useState(0)
  const [showHeaderOverride, setShowHeaderOverride] = useState(false)
  const [headerRowInput, setHeaderRowInput] = useState('')
  const [sheetNames, setSheetNames] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [mapping, setMapping] = useState({})
  const [targetMonth, setTargetMonth] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const fileInputRef = useRef(null)

  async function fetchPreview(f, overrideRow, sheet) {
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', f)
      if (overrideRow != null) fd.append('header_row', String(overrideRow))
      if (sheet) fd.append('sheet_name', sheet)
      const res = await api.post('/import/preview', fd)
      const { headers: h, header_row: detected, sheet_names: sheets } = res.data
      setHeaders(h)
      setHeaderRow(detected)
      setHeaderRowInput(String(detected + 1))
      if (sheets?.length) {
        setSheetNames(sheets)
        if (!sheet) setSelectedSheet(sheets[0])
      }
      setMapping(autoMap(h))
      setStep(1)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to read file.')
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setSheetNames([])
    setSelectedSheet('')
    fetchPreview(f, null, null)
  }

  async function handleHeaderRowOverride() {
    const row = parseInt(headerRowInput, 10) - 1
    if (isNaN(row) || row < 0) return
    await fetchPreview(file, row, selectedSheet || null)
    setShowHeaderOverride(false)
  }

  async function handleSheetChange(sheet) {
    setSelectedSheet(sheet)
    await fetchPreview(file, null, sheet)
  }

  async function handleImport() {
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mapping', JSON.stringify(mapping))
      fd.append('header_row', String(headerRow))
      if (selectedSheet) fd.append('sheet_name', selectedSheet)
      if (targetMonth) fd.append('target_month', targetMonth)
      const res = await api.post('/import/budgets', fd)
      setResults(res.data)
      setStep(2)
    } catch (e) {
      setError(e.response?.data?.detail || 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  const requiredMapped = FIELDS.filter(f => f.required).every(f => mapping[f.key])

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'background.paper', border: '1px solid rgba(240,234,214,0.12)' } }}
    >
      <DialogTitle sx={{ fontWeight: 600, color: 'text.primary' }}>
        Import Budget Goals {step === 1 ? '— Map Columns' : step === 2 ? '— Results' : ''}
      </DialogTitle>

      <DialogContent>
        {/* Step 0: Upload */}
        {step === 0 && (
          <Stack spacing={2.5} pt={1}>
            <Box
              component="label"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                border: '2px dashed rgba(240,234,214,0.2)',
                borderRadius: 2,
                py: 5,
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(143,185,150,0.04)' },
              }}
            >
              <UploadFileIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">
                Click to upload a <strong>.csv</strong> or <strong>.xlsx</strong> file
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
                Expected columns: category, monthly limit, and optionally a month
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </Box>
            {loading && <Stack alignItems="center"><CircularProgress size={24} /></Stack>}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {/* Step 1: Column mapping */}
        {step === 1 && (
          <Stack spacing={2} pt={1}>
            {sheetNames.length > 1 && (
              <FormControl size="small" fullWidth>
                <InputLabel>Sheet</InputLabel>
                <Select
                  value={selectedSheet}
                  label="Sheet"
                  onChange={e => handleSheetChange(e.target.value)}
                  disabled={loading}
                >
                  {sheetNames.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            )}

            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography variant="caption" color="text.secondary">
                Headers detected on row {headerRow + 1} of <strong>{file?.name}</strong>
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => setShowHeaderOverride(v => !v)}
              >
                Wrong row?
              </Typography>
            </Stack>

            {showHeaderOverride && (
              <Stack direction="row" gap={1} alignItems="center">
                <TextField
                  label="Header row number"
                  type="number"
                  size="small"
                  value={headerRowInput}
                  onChange={e => setHeaderRowInput(e.target.value)}
                  inputProps={{ min: 1 }}
                  sx={{ width: 160 }}
                />
                <Button size="small" variant="outlined" onClick={handleHeaderRowOverride} disabled={loading}>
                  {loading ? 'Loading…' : 'Apply'}
                </Button>
              </Stack>
            )}

            {/* Target month picker — applies to all rows, overrides any month column */}
            <FormControl size="small" fullWidth>
              <InputLabel>Apply to month</InputLabel>
              <Select
                value={targetMonth}
                label="Apply to month"
                onChange={e => setTargetMonth(e.target.value)}
              >
                {SELECTABLE_MONTHS.map(({ key, label }) => (
                  <MenuItem key={key} value={key}>{label}</MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, ml: 0.5 }}>
                {targetMonth
                  ? 'All rows will be imported as overrides for this month'
                  : 'Saves as default budgets, or use the Month column below for per-row control'}
              </Typography>
            </FormControl>

            <Divider sx={{ borderColor: 'rgba(240,234,214,0.08)' }} />

            {FIELDS.map(field => (
              <FormControl key={field.key} size="small" fullWidth>
                <InputLabel>{field.label}{field.required ? ' *' : ''}</InputLabel>
                <Select
                  value={mapping[field.key] ?? ''}
                  label={`${field.label}${field.required ? ' *' : ''}`}
                  onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                >
                  <MenuItem value=""><em>{field.required ? 'Select a column' : 'Not mapped'}</em></MenuItem>
                  {headers.map(h => (
                    <MenuItem key={h} value={h}>{h || <em>(blank header)</em>}</MenuItem>
                  ))}
                </Select>
                {field.hint && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, ml: 0.5 }}>
                    {field.hint}
                  </Typography>
                )}
              </FormControl>
            ))}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}

        {/* Step 2: Results */}
        {step === 2 && results && (
          <Stack spacing={2} pt={1}>
            <Alert severity={results.imported === 0 ? 'error' : results.skipped > 0 ? 'warning' : 'success'}>
              {results.imported} budget goal{results.imported !== 1 ? 's' : ''} imported
              {results.skipped > 0 && `, ${results.skipped} row${results.skipped !== 1 ? 's' : ''} skipped`}.
            </Alert>
            {results.errors.length > 0 && (
              <TableContainer sx={{ maxHeight: 240 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 600, borderColor: 'rgba(240,234,214,0.08)' }}>Row</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 600, borderColor: 'rgba(240,234,214,0.08)' }}>Reason skipped</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)' }}>{e.row}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', borderColor: 'rgba(240,234,214,0.08)' }}>{e.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {step < 2 && <Button variant="text" color="inherit" onClick={onClose}>Cancel</Button>}
        {step === 1 && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={loading || !requiredMapped}
            sx={{ fontWeight: 600 }}
          >
            {loading ? 'Importing…' : 'Import'}
          </Button>
        )}
        {step === 2 && (
          <Button
            variant="contained"
            onClick={results?.imported > 0 ? onImported : onClose}
            sx={{ fontWeight: 600 }}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
