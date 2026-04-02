import RestaurantIcon from '@mui/icons-material/Restaurant'
import CommuteIcon from '@mui/icons-material/Commute'
import HomeIcon from '@mui/icons-material/Home'
import MovieIcon from '@mui/icons-material/Movie'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import CategoryIcon from '@mui/icons-material/Category'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import LocalCafeIcon from '@mui/icons-material/LocalCafe'
import FlightIcon from '@mui/icons-material/Flight'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import PetsIcon from '@mui/icons-material/Pets'
import SchoolIcon from '@mui/icons-material/School'
import WifiIcon from '@mui/icons-material/Wifi'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid'
import ChildCareIcon from '@mui/icons-material/ChildCare'
import SavingsIcon from '@mui/icons-material/Savings'
import BuildIcon from '@mui/icons-material/Build'
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'

// Icon key → MUI component. Keys match the `icon` field stored in the DB.
export const ICON_REGISTRY = {
  Restaurant:      RestaurantIcon,
  Commute:         CommuteIcon,
  Home:            HomeIcon,
  Movie:           MovieIcon,
  LocalHospital:   LocalHospitalIcon,
  Category:        CategoryIcon,
  ShoppingCart:    ShoppingCartIcon,
  LocalCafe:       LocalCafeIcon,
  Flight:          FlightIcon,
  FitnessCenter:   FitnessCenterIcon,
  Pets:            PetsIcon,
  School:          SchoolIcon,
  Wifi:            WifiIcon,
  LocalGasStation: LocalGasStationIcon,
  PhoneAndroid:    PhoneAndroidIcon,
  ChildCare:       ChildCareIcon,
  Savings:         SavingsIcon,
  Build:           BuildIcon,
  CardGiftcard:    CardGiftcardIcon,
  SportsEsports:   SportsEsportsIcon,
}

// Ordered list for the icon picker UI
export const ICON_OPTIONS = [
  { key: 'Restaurant',      Icon: RestaurantIcon,      label: 'Food' },
  { key: 'ShoppingCart',    Icon: ShoppingCartIcon,    label: 'Shopping' },
  { key: 'LocalCafe',       Icon: LocalCafeIcon,       label: 'Coffee' },
  { key: 'Commute',         Icon: CommuteIcon,         label: 'Transport' },
  { key: 'Flight',          Icon: FlightIcon,          label: 'Travel' },
  { key: 'LocalGasStation', Icon: LocalGasStationIcon, label: 'Gas' },
  { key: 'Home',            Icon: HomeIcon,            label: 'Housing' },
  { key: 'Wifi',            Icon: WifiIcon,            label: 'Utilities' },
  { key: 'Build',           Icon: BuildIcon,           label: 'Repairs' },
  { key: 'Movie',           Icon: MovieIcon,           label: 'Entertainment' },
  { key: 'SportsEsports',   Icon: SportsEsportsIcon,   label: 'Gaming' },
  { key: 'CardGiftcard',    Icon: CardGiftcardIcon,    label: 'Gifts' },
  { key: 'LocalHospital',   Icon: LocalHospitalIcon,   label: 'Health' },
  { key: 'FitnessCenter',   Icon: FitnessCenterIcon,   label: 'Fitness' },
  { key: 'School',          Icon: SchoolIcon,          label: 'Education' },
  { key: 'PhoneAndroid',    Icon: PhoneAndroidIcon,    label: 'Phone' },
  { key: 'Pets',            Icon: PetsIcon,            label: 'Pets' },
  { key: 'ChildCare',       Icon: ChildCareIcon,       label: 'Childcare' },
  { key: 'Savings',         Icon: SavingsIcon,         label: 'Savings' },
  { key: 'Category',        Icon: CategoryIcon,        label: 'Other' },
]
