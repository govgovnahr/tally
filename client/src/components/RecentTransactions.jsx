import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import ButtonBase from '@mui/material/ButtonBase'
import { useExpenseTypes } from '../ExpenseTypesContext.jsx'
import { useC } from '../colors'

function shortDate(d) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleString('en-US', { month: 'short', day: 'numeric' })
}

export default function RecentTransactions({ transactions, onNavigate }) {
  const C = useC()
  const { typeMap } = useExpenseTypes()

  if (!transactions.length) {
    return <Typography variant="body2" color="text.secondary">No transactions this month.</Typography>
  }

  return (
    <Stack>
      {transactions.map(t => {
        const color = typeMap[t.expense_type]?.color ?? C.dimText
        return (
          <Stack
            key={t.id}
            direction="row"
            alignItems="center"
            gap={1.5}
            sx={{ py: 0.9, borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' } }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                {t.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                {shortDate(t.date)} · {t.expense_type}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, flexShrink: 0 }}>
              ${t.amount.toFixed(2)}
            </Typography>
          </Stack>
        )
      })}
      <ButtonBase
        onClick={() => onNavigate('all-expenses')}
        sx={{
          alignSelf: 'flex-start',
          mt: 1,
          fontSize: '0.8rem',
          fontWeight: 600,
          color: C.primary,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        View all →
      </ButtonBase>
    </Stack>
  )
}
