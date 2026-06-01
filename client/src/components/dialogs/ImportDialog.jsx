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
import InferenceBadge from '../ui/InferenceBadge.jsx'

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
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [activeFilter, setActiveFilter] = useState('fallback')
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

  async function handleFetchSuggestions() {
    setSuggestLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mapping', JSON.stringify(mapping))
      fd.append('header_row', String(headerRow))
      if (selectedSheet) fd.append('sheet_name', selectedSheet)
      const res = await api.post('/import/suggest', fd, { timeout: 90000 })
      setSuggestions(res.data)
      setOverrides({})
      setActiveFilter('fallback')
      setStep(2)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to analyze file.')
    } finally {
      setSuggestLoading(false)
    }
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
      if (suggestions) {
        const confirmed = Object.fromEntries(
          suggestions.rows.map(r => [String(r.row_idx), overrides[r.row_idx] ?? r.suggested_type])
        )
        fd.append('confirmed_types', JSON.stringify(confirmed))
      }
      const res = await api.post('/import', fd)
      setResults(res.data)
      setStep(3)
      if (res.data.savings_expenses?.length > 0) setSavingsModalOpen(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  const requiredMapped = fields.filter(f => f.required).every(f => mapping[f.key])

  const title = ['Import from CSV / Excel', 'Import — Map Columns', 'Import — Review & Confirm', 'Import — Results'][step]

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className={step === 2 ? 'max-w-4xl' : 'max-w-lg'}>
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
                Click to upload a <strong>.csv</strong>, <strong>.xlsx</strong>, or <strong>.pdf</strong> file
              </span>
              <input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
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

        {/* Step 2: Review & Confirm */}
        {step === 2 && suggestions && (
          <ReviewStep
            suggestions={suggestions}
            overrides={overrides}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onOverride={(rowIdx, category) => setOverrides(prev => ({ ...prev, [rowIdx]: category }))}
            error={error}
          />
        )}

        {/* Step 3: Results */}
        {step === 3 && results && (
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
            <Button onClick={handleFetchSuggestions} disabled={suggestLoading || !requiredMapped} className="font-semibold">
              {suggestLoading ? <><Loader2 className="animate-spin mr-2" size={16} />Analyzing…</> : 'Review →'}
            </Button>
          )}
          {step === 2 && (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleImport} disabled={loading} className="font-semibold">
                {loading
                  ? <><Loader2 className="animate-spin mr-2" size={16} />Importing…</>
                  : `Import ${suggestions?.rows?.length ?? ''} rows`}
              </Button>
            </>
          )}
          {step === 3 && (
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

const FILTER_DEFS = [
  { key: 'fallback', label: 'Unmatched' },
  { key: 'ai',       label: 'AI' },
  { key: 'file',     label: 'From File' },
  { key: 'keyword',  label: 'Keyword' },
  { key: 'rule',     label: 'Your Rules' },
  { key: 'user',     label: 'You changed' },
  { key: 'all',      label: 'All' },
]

function effectiveSource(row, overrides) {
  const isOverridden = !!overrides[row.row_idx] && overrides[row.row_idx] !== row.suggested_type
  return isOverridden ? 'user' : row.source
}

function ReviewStep({ suggestions, overrides, activeFilter, onFilterChange, onOverride, error }) {
  const C = useC()
  const { rows, income_count, ai_cap_reached, ai_enabled, valid_types } = suggestions

  const counts = { all: rows.length }
  for (const row of rows) {
    const src = effectiveSource(row, overrides)
    counts[src] = (counts[src] ?? 0) + 1
  }

  const visibleFilters = FILTER_DEFS.filter(f => (counts[f.key] ?? 0) > 0)

  const safeFilter = counts[activeFilter] > 0 ? activeFilter : 'all'
  const displayRows = safeFilter === 'all'
    ? rows
    : rows.filter(r => effectiveSource(r, overrides) === safeFilter)

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* Summary line */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: C.muted }}>
          {rows.length} expense{rows.length !== 1 ? 's' : ''}
          {income_count > 0 && ` · ${income_count} income`}
          {counts.fallback > 0
            ? <span style={{ color: C.atRisk }}> · {counts.fallback} unmatched</span>
            : <span style={{ color: C.income }}> · all categorized</span>
          }
        </span>
        {ai_cap_reached && (
          <span className="text-xs" style={{ color: C.muted }}>· AI cap reached (50)</span>
        )}
      </div>

      {/* AI-disabled notice */}
      {!ai_enabled && counts.fallback > 0 && (
        <AlertBox severity="info">
          AI categorization is off — {counts.fallback} row{counts.fallback !== 1 ? 's' : ''} couldn't be matched automatically.
          Enable AI in Account Settings for smarter suggestions on future imports.
        </AlertBox>
      )}

      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {visibleFilters.map(f => {
          const isActive = safeFilter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onFilterChange(f.key)}
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors duration-100 cursor-pointer"
              style={{
                backgroundColor: isActive ? C.primary + '18' : 'transparent',
                borderColor: isActive ? C.primary : C.borderMed,
                color: isActive ? C.primary : C.muted,
              }}
            >
              {f.label} {counts[f.key] ?? 0}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {displayRows.length === 0 ? (
        <div className="py-6 text-center text-sm" style={{ color: C.muted }}>
          No rows match this filter.
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${C.borderMed}`, maxHeight: 420, overflowY: 'auto' }}
        >
          <Table>
            <TableHeader style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: C.surfaceAlt }}>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map(row => {
                const effectiveCategory = overrides[row.row_idx] ?? row.suggested_type
                const isOverridden = !!overrides[row.row_idx] && overrides[row.row_idx] !== row.suggested_type
                return (
                  <TableRow
                    key={row.row_idx}
                    style={{ backgroundColor: isOverridden ? C.primary + '0a' : undefined }}
                  >
                    <TableCell className="text-xs py-2" style={{ color: C.warmText, maxWidth: 200 }}>
                      <span className="block truncate" title={row.name}>{row.name}</span>
                    </TableCell>
                    <TableCell className="text-xs py-2 font-mono" style={{ color: C.warmText }}>
                      ${row.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs py-2 whitespace-nowrap" style={{ color: C.muted }}>
                      {row.date}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      <NativeSelect
                        value={effectiveCategory}
                        onChange={val => onOverride(row.row_idx, val)}
                        style={{ fontSize: 12, height: 28, minWidth: 120 }}
                      >
                        {valid_types.map(t => <option key={t} value={t}>{t}</option>)}
                      </NativeSelect>
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      <InferenceBadge source={isOverridden ? 'user' : row.source} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {error && <AlertBox severity="error">{error}</AlertBox>}
    </div>
  )
}
