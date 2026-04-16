import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useC } from '../colors'

export default function PolishedCheckbox({ checked, onChange, label, accentColor }) {
  const C = useC()
  const accent = accentColor ?? C.primary
  return (
    <Box
      onClick={() => onChange(!checked)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        border: `1px solid ${checked ? accent + '55' : C.hoverStrong}`,
        bgcolor: checked ? accent + '18' : 'transparent',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        '&:hover': { bgcolor: checked ? accent + '18' : C.subtleBg },
        '&:active': { transform: 'scale(0.99)' },
      }}
    >
      <Box sx={{
        width: 20,
        height: 20,
        borderRadius: '5px',
        border: `1.5px solid ${checked ? 'transparent' : C.borderStrong}`,
        bgcolor: checked ? accent : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
      }}>
        {checked && (
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </Box>
      <Typography variant="body2" sx={{
        color: checked ? 'text.primary' : 'text.secondary',
        fontWeight: checked ? 500 : 400,
        transition: 'color 0.15s ease',
      }}>
        {label}
      </Typography>
    </Box>
  )
}
