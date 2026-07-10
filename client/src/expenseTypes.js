import React from 'react'
import {
  Utensils, Car, Home, Film, Hospital, LayoutGrid, ShoppingCart, Coffee,
  Plane, Dumbbell, PawPrint, GraduationCap, Wifi, Fuel, Smartphone, Baby,
  PiggyBank, Wrench, Gift, Gamepad2, Landmark,
} from 'lucide-react'

// Shim: call sites use style={{ fontSize, color }} (MUI convention).
// Lucide uses size + color props instead, so we translate here.
function makeIcon(LucideIcon) {
  return function IconWrapper({ style, ...props }) {
    const size = style?.fontSize ?? 20
    const color = style?.color
    const { fontSize: _fs, color: _c, ...restStyle } = style ?? {}
    return React.createElement(LucideIcon, { size, color, style: Object.keys(restStyle).length ? restStyle : undefined, ...props })
  }
}

const RestaurantIcon      = makeIcon(Utensils)
const CommuteIcon         = makeIcon(Car)
const HomeIcon            = makeIcon(Home)
const MovieIcon           = makeIcon(Film)
const LocalHospitalIcon   = makeIcon(Hospital)
const CategoryIcon        = makeIcon(LayoutGrid)
const ShoppingCartIcon    = makeIcon(ShoppingCart)
const LocalCafeIcon       = makeIcon(Coffee)
const FlightIcon          = makeIcon(Plane)
const FitnessCenterIcon   = makeIcon(Dumbbell)
const PetsIcon            = makeIcon(PawPrint)
const SchoolIcon          = makeIcon(GraduationCap)
const WifiIcon            = makeIcon(Wifi)
const LocalGasStationIcon = makeIcon(Fuel)
const PhoneAndroidIcon    = makeIcon(Smartphone)
const ChildCareIcon       = makeIcon(Baby)
const SavingsIcon         = makeIcon(PiggyBank)
const BuildIcon           = makeIcon(Wrench)
const CardGiftcardIcon    = makeIcon(Gift)
const SportsEsportsIcon   = makeIcon(Gamepad2)
const LandmarkIcon        = makeIcon(Landmark)

// Icon key → component. Keys match the `icon` field stored in the DB.
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
  Landmark:        LandmarkIcon,
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
  { key: 'Landmark',        Icon: LandmarkIcon,        label: 'Government' },
  { key: 'Category',        Icon: CategoryIcon,        label: 'Other' },
]
