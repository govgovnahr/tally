import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { useC } from '../colors'

function fmt(n) { return `$${n.toFixed(2)}` }

function CustomTooltip({ active, payload }) {
  const C = useC()
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <Box sx={{ bgcolor: C.surface, border: `1px solid ${C.border}`, borderRadius: 1, px: 1.5, py: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.name}</Typography>
      <Typography variant="caption" color="text.secondary">{fmt(d.value)} · {d.pct}%</Typography>
    </Box>
  )
}

export default function SpendingDonut({ summary, activeType, onTypeChange }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()

  const total = summary.reduce((s, x) => s + x.total, 0)
  if (!summary.length || total === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140 }}>
        <Typography variant="body2" color="text.secondary">No spending this month</Typography>
      </Box>
    )
  }

  const data = [...summary]
    .sort((a, b) => b.total - a.total)
    .map(s => ({
      name: s.type,
      value: s.total,
      pct: ((s.total / total) * 100).toFixed(1),
      color: typeMap[s.type]?.color ?? C.dimText,
    }))

  const selected = activeType && activeType !== 'All' ? activeType : null

  function handleClick(type) {
    onTypeChange?.(selected === type ? 'All' : type)
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'center', sm: 'center' }} gap={2.5}>
      {/* Donut */}
      <Box sx={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={72}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
              style={{ cursor: 'pointer' }}
              onClick={(_, index) => handleClick(data[index].name)}
            >
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.color}
                  opacity={selected && selected !== d.name ? 0.3 : 1}
                  stroke={selected === d.name ? d.color : 'none'}
                  strokeWidth={selected === d.name ? 2 : 0}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>
            {selected ? fmt(data.find(d => d.name === selected)?.value ?? 0) : fmt(total)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
            {selected ? selected : 'total'}
          </Typography>
        </Box>
      </Box>

      {/* Legend */}
      <Stack gap={0.6} sx={{ flex: 1, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
        {data.map((d, i) => {
          const isActive = selected === d.name
          return (
            <Stack
              key={i}
              direction="row"
              alignItems="center"
              gap={1}
              onClick={() => handleClick(d.name)}
              sx={{
                minWidth: 0,
                cursor: 'pointer',
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                opacity: selected && !isActive ? 0.45 : 1,
                bgcolor: isActive ? `${d.color}18` : 'transparent',
                transition: 'opacity 0.15s, background-color 0.15s',
                '&:hover': { bgcolor: `${d.color}14` },
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary', fontWeight: isActive ? 600 : 400 }}>
                {d.name}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, flexShrink: 0, color: isActive ? d.color : 'text.primary' }}>
                {d.pct}%
              </Typography>
            </Stack>
          )
        })}
      </Stack>
    </Stack>
  )
}
