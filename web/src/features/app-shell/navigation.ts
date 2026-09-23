import type { LinkProps } from '@tanstack/react-router'
import type { ParseKeys } from 'i18next'
import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarSync,
  ChartColumn,
  Stethoscope,
  Upload,
  FileUp,
  Bell,
  ScrollText,
  Smartphone,
  FolderTree,
  Gauge,
  HandCoins,
  LayoutDashboard,
  Repeat,
  Settings,
  Tags,
  Target,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { roleCan, type Permission, type Role } from '@/entities/household'

/** Byudjet ichidagi sahifa manzili — hammasi `/h/$householdId` prefiksida (E21-T02). */
export type HouseholdPath = Extract<NonNullable<LinkProps['to']>, `/h/$householdId${string}`>

export interface NavItem {
  to: HouseholdPath
  labelKey: ParseKeys
  icon: LucideIcon
  /** Faqat aniq mos kelganda faol (bosh sahifa); boshqalari — prefiks bo'yicha. */
  exact?: boolean
  /** Ko'rinish uchun kerakli huquq (BR-011); berilmasa — `read`, ya'ni hamma. */
  permission?: Permission
}

export interface NavSection {
  id: string
  titleKey: ParseKeys
  items: readonly NavItem[]
}

/**
 * Sidebar va ⌘K palitrasi uchun YAGONA manba. Bo'lim sahifasi tayyor bo'lganda
 * shu yerga qo'shiladi — o'lik havola bo'lmaydi (E22–E26).
 */
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'overview',
    titleKey: 'nav.overview',
    items: [
      { to: '/h/$householdId', labelKey: 'nav.dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: 'directories',
    titleKey: 'nav.directories',
    items: [
      { to: '/h/$householdId/accounts', labelKey: 'nav.accounts', icon: Wallet },
      { to: '/h/$householdId/categories', labelKey: 'nav.categories', icon: FolderTree },
      { to: '/h/$householdId/recurring-rules', labelKey: 'nav.recurringRules', icon: Repeat },
      { to: '/h/$householdId/limits', labelKey: 'nav.limits', icon: Gauge },
      { to: '/h/$householdId/quick-actions', labelKey: 'nav.quickActions', icon: Zap },
      { to: '/h/$householdId/tags', labelKey: 'nav.tags', icon: Tags },
      { to: '/h/$householdId/debts', labelKey: 'nav.debts', icon: HandCoins },
      { to: '/h/$householdId/goals', labelKey: 'nav.goals', icon: Target },
    ],
  },
  {
    id: 'budget',
    titleKey: 'nav.budget',
    items: [
      { to: '/h/$householdId/transactions', labelKey: 'nav.transactions', icon: ArrowLeftRight },
      { to: '/h/$householdId/plans', labelKey: 'nav.plans', icon: CalendarCheck },
      { to: '/h/$householdId/report', labelKey: 'nav.report', icon: ChartColumn },
      { to: '/h/$householdId/health', labelKey: 'nav.health', icon: Stethoscope },
      { to: '/h/$householdId/export', labelKey: 'nav.export', icon: Upload },
      {
        to: '/h/$householdId/import',
        labelKey: 'nav.import',
        icon: FileUp,
        permission: 'write',
      },
      {
        to: '/h/$householdId/audit',
        labelKey: 'nav.audit',
        icon: ScrollText,
        permission: 'manage',
      },
      {
        to: '/h/$householdId/recalc',
        labelKey: 'nav.recalc',
        icon: CalendarSync,
        permission: 'manage',
      },
      { to: '/h/$householdId/notifications', labelKey: 'nav.notifications', icon: Bell },
      {
        to: '/h/$householdId/devices',
        labelKey: 'nav.devices',
        icon: Smartphone,
        permission: 'manage',
      },
      { to: '/h/$householdId/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
]

/** E21-T03: rolga ruxsat etilmagan bandlar (va bo'shab qolgan bo'limlar) yashiriladi. */
export function navSectionsFor(
  role: Role,
  sections: readonly NavSection[] = NAV_SECTIONS,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => roleCan(role, item.permission ?? 'read')),
    }))
    .filter((section) => section.items.length > 0)
}
