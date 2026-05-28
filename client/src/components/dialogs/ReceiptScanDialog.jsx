import { useState, useRef } from 'react'
import { Camera, Loader2, Upload, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useC } from '../../colors'
import api from '../../api.js'

export default function ReceiptScanDialog({ onAdd, onClose }) {
  const C = useC()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  function handleFile(f) {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setFile(f)
    setResult(null)
    setError('')
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target.result)
    reader.readAsDataURL(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  async function handleScan() {
    if (!file) return
    setScanning(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/ai/scan-receipt', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not read receipt. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  function handleAdd() {
    if (!result) return
    const amount = parseFloat(result.amount)
    onAdd({
      name: result.name || '',
      amount: !isNaN(amount) && amount > 0 ? String(amount) : '',
      date: result.date || '',
      type: result.type_suggestion || '',
    })
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: C.warmText }}>
            <Camera size={15} style={{ color: C.primary }} />
            Scan Receipt
          </DialogTitle>
        </DialogHeader>

        {/* Upload zone */}
        {!preview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="rounded-xl flex flex-col items-center justify-center gap-2 py-10 cursor-pointer transition-colors"
            style={{
              border: `2px dashed ${dragOver ? C.primary : C.borderMed}`,
              backgroundColor: dragOver ? `${C.primary}08` : C.surfaceAlt,
            }}
          >
            <Upload size={24} style={{ color: C.muted }} />
            <p className="text-sm font-medium" style={{ color: C.warmText }}>
              Drop an image or click to browse
            </p>
            <p className="text-xs" style={{ color: C.dimText }}>JPEG, PNG, HEIC — max 10MB</p>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden" style={{ backgroundColor: C.surfaceAlt }}>
            <img src={preview} alt="Receipt preview" className="w-full max-h-64 object-contain" />
            <button
              type="button"
              onClick={() => { setFile(null); setPreview(null); setResult(null) }}
              className="absolute top-2 right-2 rounded-full p-1 cursor-pointer border-none"
              style={{ backgroundColor: C.surface, color: C.muted }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />

        {result && (
          <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: C.surfaceAlt, border: `1px solid ${C.borderMed}` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: C.dimText }}>Review extracted fields</p>
            {[
              { label: 'Merchant', key: 'name', type: 'text' },
              { label: 'Amount ($)', key: 'amount', type: 'number' },
              { label: 'Date', key: 'date', type: 'date' },
              { label: 'Category', key: 'type_suggestion', type: 'text' },
            ].map(({ label, key, type }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs w-24 flex-shrink-0" style={{ color: C.dimText }}>{label}</span>
                <input
                  type={type}
                  value={result[key] ?? ''}
                  onChange={e => setResult(prev => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 text-sm rounded-lg px-2 py-1 border outline-none bg-transparent"
                  style={{ color: C.warmText, borderColor: C.borderMed }}
                />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs px-1" style={{ color: C.overBudget }}>{error}</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} style={{ color: C.muted, borderColor: C.borderMed }}>
            Cancel
          </Button>
          {!result ? (
            <Button size="sm" onClick={handleScan} disabled={!file || scanning} className="font-semibold">
              {scanning ? <><Loader2 size={13} className="mr-1.5 animate-spin" />Scanning…</> : 'Scan Receipt'}
            </Button>
          ) : (
            <Button size="sm" onClick={handleAdd} className="font-semibold">
              Add Expense
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
