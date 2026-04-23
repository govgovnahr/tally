import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import api from '../api.js'
import { useC } from '../colors'

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function shortMonth(m) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-US', { month: 'short' })
}

export default function MonthSelector({ selectedMonth, onMonthChange, refreshKey, big }) {
  const C = useC()
  const [availableMonths, setAvailableMonths] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const dropdownRef = useRef(null)
  const cur = currentMonth()

  useEffect(() => {
    api.get('/expenses/months').then(res => {
      const months = res.data.includes(cur) ? res.data : [...res.data, cur].sort()
      setAvailableMonths(months)
    })
  }, [refreshKey])

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const idx = availableMonths.indexOf(selectedMonth)
  const hasPrev = idx > 0
  const hasNext = idx !== -1 && idx < availableMonths.length - 1
  const isFuture = selectedMonth > cur
  const isToday = selectedMonth === cur

  const byYear = availableMonths.reduceRight((acc, m) => {
    const y = m.split('-')[0]
    if (!acc[y]) acc[y] = []
    acc[y].push(m)
    return acc
  }, {})
  const years = Object.keys(byYear).sort((a, b) => b - a)

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => hasPrev && onMonthChange(availableMonths[idx - 1])}
          disabled={!hasPrev}
          className="p-1.5 rounded-xl border transition-colors duration-150 disabled:opacity-20 cursor-pointer bg-transparent"
          style={{ borderColor: C.borderLight, color: C.muted }}
        >
          <ChevronLeft size={16} />
        </button>

        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl transition-colors duration-150 cursor-pointer border-none min-w-[180px] justify-center"
            style={{ backgroundColor: menuOpen ? C.hover : 'transparent' }}
          >
            <span
              className={`${big ? 'text-2xl' : 'text-lg'} font-semibold leading-none`}
            >
              {formatMonthLabel(selectedMonth)}
            </span>
            <ChevronDown size={16} style={{ color: C.dimText, marginTop: 1 }} />
          </button>

          {menuOpen && (
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 rounded-2xl overflow-y-auto shadow-2xl py-1.5"
              style={{
                backgroundColor: C.surface,
                border: `1px solid ${C.border}`,
                minWidth: 200,
                maxHeight: 360,
              }}
            >
              {years.map((year, yi) => (
                <div key={year}>
                  {yi > 0 && <div className="h-px mx-3 my-1" style={{ backgroundColor: C.hoverStrong }} />}
                  <div
                    className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: C.dimText }}
                  >
                    {year}
                  </div>
                  {byYear[year].map(m => {
                    const isSelected = m === selectedMonth
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMenuOpen(false); onMonthChange(m) }}
                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors duration-100 border-none cursor-pointer"
                        style={{
                          backgroundColor: isSelected ? C.menuSelected : 'transparent',
                          color: isSelected ? C.primary : C.warmText,
                          fontWeight: isSelected ? 700 : 400,
                        }}
                      >
                        {shortMonth(m)}
                        {m === cur && (
                          <span className="text-xs" style={{ color: C.dimText }}>current</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => hasNext && onMonthChange(availableMonths[idx + 1])}
          disabled={!hasNext}
          className="p-1.5 rounded-xl border transition-colors duration-150 disabled:opacity-20 cursor-pointer bg-transparent"
          style={{ borderColor: C.borderLight, color: C.muted }}
        >
          <ChevronRight size={16} />
        </button>

        {isFuture && (
          <span
            className="text-[10px] font-medium tracking-wider px-2 py-0.5 rounded-full"
            style={{
              color: C.muted,
              backgroundColor: C.hoverMed,
              border: `1px solid ${C.borderLight}`,
            }}
          >
            projection
          </span>
        )}
      </div>

      {!isToday && (
        <button
          type="button"
          onClick={() => onMonthChange(cur)}
          className="text-xs bg-transparent border-none cursor-pointer font-[inherit] transition-colors duration-150"
          style={{ color: C.dimText }}
        >
          Back to current month
        </button>
      )}
    </div>
  )
}
