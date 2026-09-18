import { Monitor, Moon, Sun } from 'lucide-react'

import type { AppLocale } from '@/shared/config/locale'

export const THEMES = ['light', 'dark', 'system'] as const

export const THEME_ICON = { light: Sun, dark: Moon, system: Monitor } as const

/** Til nomlari o'sha tilning o'zida yoziladi — qaysi til tanlanganidan qat'i nazar. */
export const LOCALE_NAMES: Record<AppLocale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
}
