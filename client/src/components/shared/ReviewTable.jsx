import { useC } from '../../colors'
import AlertBox from '../ui/AlertBox.jsx'
import NativeSelect from '../inputs/NativeSelect.jsx'
import InferenceBadge from '../ui/InferenceBadge.jsx'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const FILTER_DEFS = [
  { key: 'fallback',       label: 'Unmatched' },
  { key: 'ai',             label: 'AI' },
  { key: 'plaid_category', label: 'Bank Category' },
  { key: 'file',           label: 'From File' },
  { key: 'keyword',        label: 'Keyword' },
  { key: 'rule',           label: 'Your Rules' },
  { key: 'user',           label: 'You changed' },
  { key: 'all',            label: 'All' },
]

function effectiveSource(row, overrides) {
  const isOverridden = !!overrides[row.id] && overrides[row.id] !== row.suggested_type
  return isOverridden ? 'user' : row.source
}

/**
 * Shared review-step table for confirming/overriding suggested categories before
 * committing a batch of transactions. Used by both CSV import (ImportDialog) and
 * Plaid's first-sync review (PlaidReviewDialog) — rows just need a stable `id`,
 * `name`, `amount`, `date`, `suggested_type`, `source`.
 */
export default function ReviewTable({
  rows, overrides, activeFilter, onFilterChange, onOverride, validTypes,
  error, incomeCount = 0, aiCapReached = false, aiEnabled = true,
}) {
  const C = useC()

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
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs" style={{ color: C.muted }}>
          {rows.length} expense{rows.length !== 1 ? 's' : ''}
          {incomeCount > 0 && ` · ${incomeCount} income`}
          {counts.fallback > 0
            ? <span style={{ color: C.atRisk }}> · {counts.fallback} unmatched</span>
            : <span style={{ color: C.income }}> · all categorized</span>
          }
        </span>
        {aiCapReached && (
          <span className="text-xs" style={{ color: C.muted }}>· AI cap reached (50)</span>
        )}
      </div>

      {!aiEnabled && counts.fallback > 0 && (
        <AlertBox severity="info">
          AI categorization is off — {counts.fallback} row{counts.fallback !== 1 ? 's' : ''} couldn't be matched automatically.
          Enable AI in Account Settings for smarter suggestions on future imports.
        </AlertBox>
      )}

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
                const effectiveCategory = overrides[row.id] ?? row.suggested_type
                const isOverridden = !!overrides[row.id] && overrides[row.id] !== row.suggested_type
                return (
                  <TableRow
                    key={row.id}
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
                        onChange={val => onOverride(row.id, val)}
                        style={{ fontSize: 12, height: 28, minWidth: 120 }}
                      >
                        {validTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
