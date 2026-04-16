import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import LinearProgress from '@mui/material/LinearProgress'
import ButtonBase from '@mui/material/ButtonBase'
import { useC } from '../colors'

export default function SavingsGoalsMini({ goals, onNavigate }) {
  const C = useC()
  const active = goals.filter(g => !g.completed && !g.is_paused).slice(0, 3)

  if (!active.length) {
    return (
      <Box sx={{ py: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          No active goals.{' '}
          <ButtonBase
            onClick={() => onNavigate('savings')}
            sx={{ fontSize: '0.875rem', color: C.primary, fontFamily: 'inherit', verticalAlign: 'baseline', '&:hover': { textDecoration: 'underline' } }}
          >
            Set one up →
          </ButtonBase>
        </Typography>
      </Box>
    )
  }

  return (
    <Stack gap={1.75}>
      {active.map(g => {
        const pct = g.target > 0 ? Math.min((g.effective_progress / g.target) * 100, 100) : 0
        const color = g.color ?? C.primary
        return (
          <Box key={g.id}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.name}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                {pct.toFixed(0)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 5,
                borderRadius: 2,
                bgcolor: C.hoverStrong,
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
              }}
            />
          </Box>
        )
      })}
      <ButtonBase
        onClick={() => onNavigate('savings')}
        sx={{
          alignSelf: 'flex-start',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: C.primary,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          mt: 0.25,
          '&:hover': { textDecoration: 'underline' },
        }}
      >
        View all →
      </ButtonBase>
    </Stack>
  )
}
