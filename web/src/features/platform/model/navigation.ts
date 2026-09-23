import type { LinkProps } from '@tanstack/react-router'
import type { ParseKeys } from 'i18next'
import {
  Activity,
  Library,
  Megaphone,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'

/** Platforma bo'limi manzili (`/platform/...`). */
export type PlatformPath = Extract<NonNullable<LinkProps['to']>, `/platform${string}`>

export interface PlatformNavItem {
  to: PlatformPath
  labelKey: ParseKeys
  icon: LucideIcon
  exact?: boolean
}

/**
 * E26: super-admin sahifalari — byudjetdan tashqarida. Bo'lim tayyor
 * bo'lganda shu yerga qo'shiladi (o'lik havola bo'lmaydi).
 */
export const PLATFORM_NAV: readonly PlatformNavItem[] = [
  { to: '/platform', labelKey: 'platform.directories.title', icon: Library, exact: true },
  { to: '/platform/config', labelKey: 'platform.config.title', icon: SlidersHorizontal },
  { to: '/platform/announcements', labelKey: 'platform.announcements.title', icon: Megaphone },
  { to: '/platform/users', labelKey: 'platform.users.title', icon: Users },
  { to: '/platform/health', labelKey: 'platform.health.title', icon: Activity },
]
