import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.jsx'
import { useC } from '../../colors'
import api from '../../api.js'

const CLEAR_ITEMS = [
  { key: 'expenses',      label: 'Expenses',      description: 'All expense transactions' },
  { key: 'income',        label: 'Income',         description: 'All income entries' },
  { key: 'budgets',       label: 'Budget limits',  description: 'Default limits and monthly overrides' },
  { key: 'savings',       label: 'Savings goals',  description: 'All goals and contributions' },
  { key: 'import-rules',  label: 'Import rules',   description: 'Auto-categorization rules' },
  { key: 'categories',    label: 'Categories',     description: 'Resets to default categories' },
  { key: 'groups',        label: 'Groups',         description: 'All macrocategories' },
]

export default function ClearAllDialog() {
  const C = useC()
  const queryClient = useQueryClient()

  const [specificOpen, setSpecificOpen] = useState(false)
  const [clearTarget, setClearTarget] = useState(null)
  const [specificConfirmText, setSpecificConfirmText] = useState('')
  const [specificLoading, setSpecificLoading] = useState(false)
  const [specificError, setSpecificError] = useState('')

  const [confirmClear, setConfirmClear] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearLoading, setClearLoading] = useState(false)
  const [clearError, setClearError] = useState('')

  const inputStyle = {
    width: '100%',
    padding: '9px 13px',
    borderRadius: 9,
    border: `1px solid ${C.border}`,
    background: C.bg,
    color: C.text,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const section = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: '20px 24px',
    marginBottom: 16,
  }

  const handleClearData = async () => {
    setClearLoading(true)
    setClearError('')
    try {
      await api.delete('/auth/data')
      setConfirmClear(false)
      setClearConfirmText('')
      queryClient.invalidateQueries()
    } catch (err) {
      setClearError(err.response?.data?.detail || 'Failed to clear data. Please try again.')
    } finally {
      setClearLoading(false)
    }
  }

  const handleSpecificClear = async () => {
    setSpecificLoading(true)
    setSpecificError('')
    try {
      await api.delete(`/auth/data/${clearTarget.key}`)
      queryClient.invalidateQueries()
      setClearTarget(null)
      setSpecificConfirmText('')
    } catch (err) {
      setSpecificError(err.response?.data?.detail || 'Failed to clear data.')
    } finally {
      setSpecificLoading(false)
    }
  }

  return (
    <>
      {/* Clear specific data */}
      <div style={section}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setSpecificOpen(o => !o)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trash2 size={16} color={C.muted} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.text }}>Clear specific data</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>Remove individual data types</p>
            </div>
          </div>
          {specificOpen ? <ChevronUp size={16} color={C.muted} /> : <ChevronDown size={16} color={C.muted} />}
        </div>

        {specificOpen && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CLEAR_ITEMS.map(item => (
              <div
                key={item.key}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 10,
                  background: C.subtleBg,
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: C.text }}>{item.label}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 12, color: C.muted }}>{item.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setClearTarget(item); setSpecificConfirmText(''); setSpecificError('') }}
                  style={{
                    padding: '5px 12px', borderRadius: 8,
                    border: '1px solid rgba(229,115,115,0.4)',
                    background: 'rgba(229,115,115,0.08)',
                    color: '#e57373', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}
                >
                  Clear
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear all data */}
      <div style={{ ...section, borderColor: 'rgba(229,115,115,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trash2 size={16} color="#e57373" />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: C.text }}>Clear all data</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: C.muted }}>Permanently delete all expenses, budgets, and goals</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setConfirmClear(true); setClearConfirmText(''); setClearError('') }}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: '1px solid rgba(229,115,115,0.4)',
              background: 'rgba(229,115,115,0.08)',
              color: '#e57373', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Clear data
          </button>
        </div>
      </div>

      {/* Specific clear dialog */}
      <Dialog
        open={clearTarget !== null}
        onOpenChange={v => { if (!specificLoading && !v) { setClearTarget(null); setSpecificConfirmText('') } }}
      >
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>Clear {clearTarget?.label}?</DialogTitle>
          </DialogHeader>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: C.muted }}>
            {clearTarget?.description} will be permanently deleted.{' '}
            <strong style={{ color: C.text }}>This cannot be undone.</strong>
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: C.muted }}>
            Type <strong style={{ color: C.text }}>DELETE</strong> to confirm:
          </p>
          <input
            type="text"
            value={specificConfirmText}
            onChange={e => { setSpecificConfirmText(e.target.value); setSpecificError('') }}
            placeholder="DELETE"
            style={{ ...inputStyle, marginBottom: 4 }}
            autoFocus
          />
          {specificError && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#e57373' }}>{specificError}</p>}
          <DialogFooter style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => { setClearTarget(null); setSpecificConfirmText('') }}
              disabled={specificLoading}
              style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600,
                cursor: specificLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSpecificClear}
              disabled={specificLoading || specificConfirmText !== 'DELETE'}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: specificConfirmText === 'DELETE' ? '#e57373' : 'rgba(229,115,115,0.3)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: (specificLoading || specificConfirmText !== 'DELETE') ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
            >
              {specificLoading ? 'Clearing…' : `Clear ${clearTarget?.label ?? ''}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear all dialog */}
      <Dialog
        open={confirmClear}
        onOpenChange={v => { if (!clearLoading) { setConfirmClear(v); setClearConfirmText('') } }}
      >
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>Clear all data?</DialogTitle>
          </DialogHeader>
          <p style={{ margin: '0 0 12px', fontSize: 14, color: C.muted }}>
            This will permanently delete all your expenses, income, budgets, savings goals, import rules, and categories.
            Your account will not be deleted.{' '}
            <strong style={{ color: C.text }}>This cannot be undone.</strong>
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: C.muted }}>
            Type <strong style={{ color: C.text }}>DELETE</strong> to confirm:
          </p>
          <input
            type="text"
            value={clearConfirmText}
            onChange={e => { setClearConfirmText(e.target.value); setClearError('') }}
            placeholder="DELETE"
            style={{ ...inputStyle, marginBottom: 4 }}
            autoFocus
          />
          {clearError && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#e57373' }}>{clearError}</p>}
          <DialogFooter style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => { setConfirmClear(false); setClearConfirmText('') }}
              disabled={clearLoading}
              style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600,
                cursor: clearLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleClearData}
              disabled={clearLoading || clearConfirmText !== 'DELETE'}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: clearConfirmText === 'DELETE' ? '#e57373' : 'rgba(229,115,115,0.3)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: (clearLoading || clearConfirmText !== 'DELETE') ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
            >
              {clearLoading ? 'Clearing…' : 'Clear all data'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
