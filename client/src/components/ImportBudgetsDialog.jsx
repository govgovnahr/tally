import { useState, useRef } from 'react'
import { useC } from '../colors'
import { Upload, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
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

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function AlertBox({ severity, children }) {
  const C = useC()
  const colors = {
    success: { bg: `${C.onTrack}15`, border: `${C.onTrack}40`, text: C.onTrack },
    warning: { bg: `${C.atRisk}15`, border: `${C.atRisk}40`, text: C.atRisk },
    error:   { bg: `${C.overBudget}15`, border: `${C.overBudget}40`, text: C.overBudget },
  }
  const s = colors[severity] ?? colors.error
  return (
    <div
      className="text-sm px-3 py-2.5 rounded-lg"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {children}
    </div>
  )
}

function NativeSelect({ value, onChange, children, disabled }) {
  const C = useC()
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 w-full rounded-lg border px-3 text-sm bg-transparent"
      style={{ borderColor: C.borderLight, color: C.warmText }}
    >
      {children}
    </select>
  )
}

export default function ImportBudgetsDialog({ onClose, onImported }) {
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

  const title = `Import Budget Goals${step === 1 ? ' — Map Columns' : step === 2 ? ' — Results' : ''}`

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
              htmlFor="budget-import-file"
              className="flex flex-col items-center gap-4 border-2 border-dashed rounded-2xl py-10 cursor-pointer transition-colors duration-150"
              style={{ borderColor: C.borderMed }}
            >
              <Upload size={40} style={{ color: C.muted }} />
              <span className="text-sm" style={{ color: C.muted }}>
                Click to upload a <strong>.csv</strong> or <strong>.xlsx</strong> file
              </span>
              <span className="text-xs opacity-60" style={{ color: C.muted }}>
                Expected columns: category, monthly limit, and optionally a month
              </span>
              <input
                id="budget-import-file"
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

            {/* Target month */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Apply to month</label>
              <div className="flex gap-2 items-center">
                <input
                  type="month"
                  value={targetMonth}
                  onChange={e => setTargetMonth(e.target.value)}
                  className="h-9 flex-1 rounded-lg border px-3 text-sm bg-transparent"
                  style={{
                    borderColor: C.borderLight,
                    color: targetMonth ? C.warmText : C.muted,
                    colorScheme: C.mode === 'dark' ? 'dark' : 'light',
                  }}
                />
                {targetMonth && (
                  <button
                    type="button"
                    onClick={() => setTargetMonth('')}
                    className="text-xs bg-transparent border-none cursor-pointer font-[inherit] hover:underline shrink-0"
                    style={{ color: C.muted }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs" style={{ color: C.muted }}>
                {targetMonth
                  ? 'All rows will be imported as overrides for this month'
                  : 'Saves as default budgets, or use the Month column below for per-row control'}
              </p>
            </div>

            <div className="h-px" style={{ backgroundColor: C.hoverStrong }} />

            {FIELDS.map(field => (
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
              {results.imported} budget goal{results.imported !== 1 ? 's' : ''} imported
              {results.skipped > 0 && `, ${results.skipped} row${results.skipped !== 1 ? 's' : ''} skipped`}.
            </AlertBox>
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
    </Dialog>
  )
}
