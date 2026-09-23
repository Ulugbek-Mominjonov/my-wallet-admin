import { DEFAULT_LOCALE, INTL_LOCALE, type AppLocale } from '@/shared/config/locale'

// Raqamli ko'rinish: brauzer ICU'sida uz oy nomlari to'liq emas ("2026 M09 22").
const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

const DATE: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  // Sana-kalit (`YYYY-MM-DD`) — vaqt zonasiz; UTC'da o'qib, kun siljimaydi.
  timeZone: 'UTC',
}

/** Kalendar sana (`YYYY-MM-DD`) foydalanuvchi tilida, raqamli: 03.09.2026. */
export function formatDate(isoDate: string, locale: AppLocale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], DATE).format(new Date(`${isoDate}T00:00:00Z`))
}

/** Sana va vaqt foydalanuvchi tilida (brauzer vaqt zonasida). */
export function formatDateTime(value: Date | string, locale: AppLocale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], DATE_TIME).format(new Date(value))
}

/** Bugungi sana `YYYY-MM-DD` — byudjet vaqt zonasida (BR-002). */
export function todayIso(timeZone: string, now = new Date()): string {
  // en-CA — ISO tartibidagi sana (YYYY-MM-DD).
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)
}

/** Sana-kalitga kun qo'shish (manfiy ham): addDays('2026-09-30', 1) → '2026-10-01'. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Oy nomlari kabi ro'yxatdan: brauzer ICU'sida uz hafta kunlari to'liq emas.
const WEEKDAY_NAMES: Record<AppLocale, readonly string[]> = {
  uz: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'],
  ru: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
}

/** ISO hafta kuni (1 — dushanba … 7 — yakshanba) foydalanuvchi tilida. */
export function weekdayName(isoDow: number, locale: AppLocale = DEFAULT_LOCALE): string {
  return WEEKDAY_NAMES[locale][isoDow - 1] ?? String(isoDow)
}
