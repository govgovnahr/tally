import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ButtonBase from '@mui/material/ButtonBase'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useC } from '../colors'

export default function OutlierAlert({ count, onSeeDetails }) {
  const C = useC()
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 1,
        bgcolor: `${C.atRisk}18`,
        border: `1px solid ${C.atRisk}40`,
        borderRadius: 2,
        px: 2,
        py: 1.25,
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon sx={{ fontSize: 18, color: C.atRisk }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: C.atRisk }}>
          {count} unusual {count === 1 ? 'expense' : 'expenses'} detected this month
        </Typography>
      </Box>
      <ButtonBase
        onClick={onSeeDetails}
        sx={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: C.atRisk,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          px: 1.5,
          py: 0.5,
          borderRadius: 1,
          '&:hover': { bgcolor: `${C.atRisk}18` },
        }}
      >
        See details →
      </ButtonBase>
    </Box>
  )
}
