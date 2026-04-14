import { useEffect, useState, useRef } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import api from '../api.js'
import { DROPDOWN_PAPER_SX, DROPDOWN_ITEM_SX } from '../menuStyles.js'

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

export default function MonthSelector({ selectedMonth, onMonthChange, refreshKey }) {
  const [availableMonths, setAvailableMonths] = useState([])
  const [menuAnchor, setMenuAnchor] = useState(null)
  const cur = currentMonth()

  useEffect(() => {
    api.get('/expenses/months').then(res => {
      const months = res.data.includes(cur) ? res.data : [...res.data, cur].sort()
      setAvailableMonths(months)
    })
  }, [refreshKey])

  const idx = availableMonths.indexOf(selectedMonth)
  const hasPrev = idx > 0
  const hasNext = idx !== -1 && idx < availableMonths.length - 1
  const isFuture = selectedMonth > cur
  const isToday = selectedMonth === cur

  // Group months by year, most recent year first
  const byYear = availableMonths.reduceRight((acc, m) => {
    const y = m.split('-')[0]
    if (!acc[y]) acc[y] = []
    acc[y].push(m)
    return acc
  }, {})
  const years = Object.keys(byYear).sort((a, b) => b - a)

  function handleMenuSelect(m) {
    setMenuAnchor(null)
    onMonthChange(m)
  }

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <IconButton
          onClick={() => onMonthChange(availableMonths[idx - 1])}
          disabled={!hasPrev}
          sx={{
            color: 'text.secondary',
            border: '1px solid rgba(240,234,214,0.15)',
            borderRadius: 1.5,
            p: 0.5,
            '&:hover': { color: 'text.primary', borderColor: 'rgba(240,234,214,0.35)', bgcolor: 'rgba(240,234,214,0.04)' },
            '&.Mui-disabled': { opacity: 0.2 },
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        <Stack
          direction="row"
          alignItems="center"
          gap={0.25}
          onClick={e => setMenuAnchor(e.currentTarget)}
          sx={{
            minWidth: 180,
            justifyContent: 'center',
            cursor: 'pointer',
            borderRadius: 1.5,
            px: 1,
            py: 0.5,
            '&:hover': { bgcolor: 'rgba(240,234,214,0.04)' },
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1 }}>
            {formatMonthLabel(selectedMonth)}
          </Typography>
          <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.disabled', mt: '1px' }} />
        </Stack>

        <IconButton
          onClick={() => onMonthChange(availableMonths[idx + 1])}
          disabled={!hasNext}
          sx={{
            color: 'text.secondary',
            border: '1px solid rgba(240,234,214,0.15)',
            borderRadius: 1.5,
            p: 0.5,
            '&:hover': { color: 'text.primary', borderColor: 'rgba(240,234,214,0.35)', bgcolor: 'rgba(240,234,214,0.04)' },
            '&.Mui-disabled': { opacity: 0.2 },
          }}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>

        {isFuture && (
          <Chip
            label="projection"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              letterSpacing: '0.04em',
              color: 'text.secondary',
              bgcolor: 'rgba(240,234,214,0.06)',
              border: '1px solid rgba(240,234,214,0.15)',
            }}
          />
        )}
      </Stack>

      {!isToday && (
        <Typography
          variant="caption"
          onClick={() => onMonthChange(cur)}
          sx={{ color: 'text.disabled', cursor: 'pointer', '&:hover': { color: 'text.secondary' } }}
        >
          Back to current month
        </Typography>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { ...DROPDOWN_PAPER_SX, minWidth: 200 } } }}
      >
        {years.map((year, yi) => [
          yi > 0 && <Divider key={`div-${year}`} sx={{ borderColor: 'rgba(240,234,214,0.08)' }} />,
          <Typography
            key={`year-${year}`}
            variant="caption"
            sx={{ display: 'block', px: 2, pt: 1, pb: 0.5, color: 'text.disabled', fontWeight: 600, letterSpacing: '0.06em' }}
          >
            {year}
          </Typography>,
          ...byYear[year].map(m => (
            <MenuItem
              key={m}
              selected={m === selectedMonth}
              onClick={() => handleMenuSelect(m)}
              sx={DROPDOWN_ITEM_SX}
            >
              {shortMonth(m)}
              {m === cur && (
                <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.disabled' }}>
                  current
                </Typography>
              )}
            </MenuItem>
          ))
        ])}
      </Menu>
    </Stack>
  )
}
