import RestaurantIcon from '@mui/icons-material/Restaurant'
import CommuteIcon from '@mui/icons-material/Commute'
import HomeIcon from '@mui/icons-material/Home'
import MovieIcon from '@mui/icons-material/Movie'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import CategoryIcon from '@mui/icons-material/Category'

export const EXPENSE_TYPES = [
  { type: 'Food',          color: '#e8a87c', Icon: RestaurantIcon },
  { type: 'Transport',     color: '#82b4e0', Icon: CommuteIcon },
  { type: 'Housing',       color: '#c49ee8', Icon: HomeIcon },
  { type: 'Entertainment', color: '#f0c040', Icon: MovieIcon },
  { type: 'Health',        color: '#80cbc4', Icon: LocalHospitalIcon },
  { type: 'Other',         color: '#a0a0a0', Icon: CategoryIcon },
]

// Keyed by type name for O(1) lookups
export const TYPE_MAP = Object.fromEntries(EXPENSE_TYPES.map(t => [t.type, t]))

// Plain list of type name strings, for selects / filters / validation
export const TYPE_NAMES = EXPENSE_TYPES.map(t => t.type)
