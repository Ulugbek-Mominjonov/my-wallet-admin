import type { LinkProps } from '@tanstack/react-router'
import type { ParseKeys } from 'i18next'
import { LayoutDashboard, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: NonNullable<LinkProps['to']>
  labelKey: ParseKeys
  icon: LucideIcon
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
    items: [{ to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard }],
  },
]
