import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CarTaxiFront,
  CirclePlus,
  Coffee,
  CreditCard,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  PartyPopper,
  PawPrint,
  Percent,
  PiggyBank,
  Plane,
  Receipt,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sofa,
  Trophy,
  User,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Neytral ikon kalitlari (contracts/api.md "Ikon kalitlari") → Lucide.
 * Mobil o'z ikonlarini shu kalitlardan chizadi; noma'lum kalit — `dots`.
 */
export const ICON_GROUPS = {
  finance: {
    wallet: Wallet,
    banknote: Banknote,
    'credit-card': CreditCard,
    bank: Landmark,
    phone: Smartphone,
    'piggy-bank': PiggyBank,
    briefcase: Briefcase,
    trophy: Trophy,
    'plus-circle': CirclePlus,
    percent: Percent,
    receipt: Receipt,
  },
  home: { home: House, bolt: Zap, wifi: Wifi, sofa: Sofa, tools: Wrench },
  food: { cart: ShoppingCart, utensils: Utensils, coffee: Coffee },
  transport: { bus: Bus, car: Car, fuel: Fuel, taxi: CarTaxiFront, plane: Plane },
  personal: {
    user: User,
    'heart-pulse': HeartPulse,
    'graduation-cap': GraduationCap,
    shirt: Shirt,
    party: PartyPopper,
    gift: Gift,
    baby: Baby,
    paw: PawPrint,
    dumbbell: Dumbbell,
    book: BookOpen,
  },
  other: { dots: Ellipsis },
} as const satisfies Record<string, Record<string, LucideIcon>>

export type IconGroup = keyof typeof ICON_GROUPS

const ICONS: Readonly<Record<string, LucideIcon>> = Object.assign(
  {},
  ...Object.values(ICON_GROUPS),
) as Record<string, LucideIcon>

export const DEFAULT_ICON = 'dots'

export function iconFor(key: string | null | undefined): LucideIcon {
  return (key ? ICONS[key] : undefined) ?? Ellipsis
}

/** Rang tanlagichi — standart spravochnik ranglari (serverdagi seed bilan bir xil). */
export const ENTITY_COLORS = [
  '#16A34A',
  '#22C55E',
  '#84CC16',
  '#0D9488',
  '#0EA5E9',
  '#3B82F6',
  '#4F46E5',
  '#7C3AED',
  '#A855F7',
  '#EC4899',
  '#E11D48',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#64748B',
] as const
