/** UI tillari: o'zbek (lotin) asosiy, rus, ingliz (ADR-15). */
export const APP_LOCALES = ['uz', 'ru', 'en'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = 'uz'

/** Intl API uchun BCP 47 teglari. */
export const INTL_LOCALE: Record<AppLocale, string> = {
  uz: 'uz-Latn-UZ',
  ru: 'ru-RU',
  en: 'en-GB',
}
