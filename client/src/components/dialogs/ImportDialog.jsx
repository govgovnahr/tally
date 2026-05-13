import { useState, useRef } from 'react'
import { useC } from '../../colors'
import { Upload, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import api from '../../api.js'
import SavingsLinkModal from './SavingsLinkModal.jsx'
import AlertBox from '../ui/AlertBox.jsx'
import NativeSelect from '../inputs/NativeSelect.jsx'

const IMPORT_FIELDS = [
  { key: 'name',         label: 'Name / Description',       required: true,  hint: null },
  { key: 'amount',       label: 'Amount',                   required: true,  hint: 'Negative = expense, positive = income' },
  { key: 'date',         label: 'Date',                     required: true,  hint: null },
  { key: 'record_type',  label: 'Debit / Credit column',    required: false, hint: 'Optional — used to distinguish expenses from income' },
  { key: 'type',         label: 'Expense Type',             required: false, hint: 'Optional — auto-detected from description if not mapped' },
  { key: 'is_recurring', label: 'Recurring?',               required: false, hint: null },
]

function autoMap(headers, fields) {
  const result = {}
  for (const field of fields) {
    const match = headers.find(h =>
      h.toLowerCase().replace(/[^a-z]/g, '') ===
      field.key.toLowerCase().replace(/[^a-z]/g, '')
    ) ?? headers.find(h => {
      const hl = h.toLowerCase()
      if (field.key === 'name') return hl.includes('desc') || hl.includes('name') || hl.includes('payee') || hl.includes('merchant')
      if (field.key === 'amount') return hl.includes('amount') || hl.includes('debit') || hl.includes('credit') || hl.includes('total')
      if (field.key === 'date') return hl.includes('date') || hl.includes('time')
      if (field.key === 'type') return hl.includes('type') || hl.includes('categ') || hl.includes('label')
      return false
    })
    result[field.key] = match ?? ''
  }
  return result
}


export default function ImportDialog({ onClose, onImported }) {
  const C = useC()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [headerRow, setHeaderRow] = useState(0)
  const [showHeaderOverride, setShowHeaderOverride] = useState(false)
  const [headerRowInput, setHeaderRowInput] = useState('')
  const [sheetNames, setSheetNames] = useState([])
  const [selectedSheet, setSelectedSheet] = useState('')
  const [mapping, setMapping] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [savingsModalOpen, setSavingsModalOpen] = useState(false)
  const fileInputRef = useRef(null)

  const fields = IMPORT_FIELDS

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
      setMapping(autoMap(h, fields))
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
      const res = await api.post('/import', fd)
      setResults(res.data)
      setStep(2)
      if (res.data.savings_expenses?.length > 0) setSavingsModalOpen(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  const requiredMapped = fields.filter(f => f.required).every(f => mapping[f.key])

  const title = step === 0 ? 'Import from CSV / Excel' : step === 1 ? 'Import — Map Columns' : 'Import — Results'

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Step 0: Upload */}
        {step === 0 && (
          <div className="flex flex-col gap-5 pt-1">
            <label
              htmlFor="import-file"
              className="flex flex-col items-center gap-4 border-2 border-dashed rounded-2xl py-10 cursor-pointer transition-colors duration-150"
              style={{ borderColor: C.borderMed }}
            >
              <Upload size={40} style={{ color: C.muted }} />
              <span className="text-sm" style={{ color: C.muted }}>
                Click to upload a <strong>.csv</strong> or <strong>.xlsx</strong> file
              </span>
              <input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {loading && <div className="flex justify-center"><Loader2 className="animate-spin" size={24} style={{ color: C.primary }} /></div>}
            {error && <AlertBox severity="error">{error}</AlertBox>}
          </div>
        )}

        {/* Step 1: Column mapping */}
        {step === 1 && (
          <div className="flex flex-col gap-4 pt-1">
            {sheetNames.length > 1 && (
              <NativeSelect value={selectedSheet} onChange={handleSheetChange} disabled={loading}>
                {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
              </NativeSelect>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: C.muted }}>
                Headers detected on row {headerRow + 1} of <strong>{file?.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowHeaderOverride(v => !v)}
                className="text-xs bg-transparent border-none cursor-pointer font-[inherit] hover:underline"
                style={{ color: C.primary }}
              >
                Wrong row?
              </button>
            </div>

            {showHeaderOverride && (
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  value={headerRowInput}
                  onChange={e => setHeaderRowInput(e.target.value)}
                  min="1"
                  className="w-36"
                  placeholder="Row number"
                />
                <Button size="sm" variant="outline" onClick={handleHeaderRowOverride} disabled={loading}>
                  {loading ? 'Loading…' : 'Apply'}
                </Button>
              </div>
            )}

            {fields.map(field => (
              <div key={field.key} className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {field.label}{field.required ? ' *' : ''}
                </label>
                <NativeSelect
                  value={mapping[field.key] ?? ''}
                  onChange={val => setMapping(prev => ({ ...prev, [field.key]: val }))}
                >
                  <option value="">{field.required ? 'Select a column' : 'Not mapped'}</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h || '(blank header)'}</option>
                  ))}
                </NativeSelect>
                {field.hint && <p className="text-xs" style={{ color: C.muted }}>{field.hint}</p>}
              </div>
            ))}

            {error && <AlertBox severity="error">{error}</AlertBox>}
          </div>
        )}

        {/* Step 2: Results */}
        {step === 2 && results && (
          <div className="flex flex-col gap-4 pt-1">
            <AlertBox severity={results.imported === 0 ? 'error' : results.skipped > 0 ? 'warning' : 'success'}>
              {results.imported} record{results.imported !== 1 ? 's' : ''} imported
              {results.skipped > 0 && `, ${results.skipped} skipped`}.
            </AlertBox>
            {results.savings_expenses?.length > 0 && (
              <AlertBox
                severity="info"
                action={
                  <button
                    type="button"
                    className="text-xs font-semibold bg-transparent border-none cursor-pointer font-[inherit]"
                    onClick={() => setSavingsModalOpen(true)}
                    style={{ color: C.income }}
                  >
                    Assign
                  </button>
                }
              >
                {results.savings_expenses.length} Savings transaction{results.savings_expenses.length !== 1 ? 's' : ''} — assign to goals
              </AlertBox>
            )}
            {results.errors.length > 0 && (
              <div className="max-h-60 overflow-y-auto rounded-lg" style={{ border: `1px solid ${C.border}` }}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold" style={{ color: C.muted }}>Row</TableHead>
                      <TableHead className="text-xs font-semibold" style={{ color: C.muted }}>Reason skipped</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs" style={{ color: C.muted }}>{e.row}</TableCell>
                        <TableCell className="text-xs" style={{ color: C.muted }}>{e.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step < 2 && <Button variant="ghost" onClick={onClose}>Cancel</Button>}
          {step === 1 && (
            <Button onClick={handleImport} disabled={loading || !requiredMapped} className="font-semibold">
              {loading ? <><Loader2 className="animate-spin mr-2" size={16} />Importing…</> : 'Import'}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={results?.imported > 0 ? onImported : onClose} className="font-semibold">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {savingsModalOpen && results?.savings_expenses?.length > 0 && (
        <SavingsLinkModal
          open
          expenses={results.savings_expenses}
          onClose={() => setSavingsModalOpen(false)}
          onDone={() => setSavingsModalOpen(false)}
        />
      )}
    </Dialog>
  )
}
