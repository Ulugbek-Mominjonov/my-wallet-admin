import { DEFAULT_LOCALE, INTL_LOCALE, type AppLocale } from '@/shared/config/locale'

// Raqamli ko'rinish: brauzer ICU'sida uz oy nomlari to'liq emas ("2026 M09 22").
const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

/** Sana va vaqt foydalanuvchi tilida (brauzer vaqt zonasida). */
export function formatDateTime(value: Date | string, locale: AppLocale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], DATE_TIME).format(new Date(value))
}
