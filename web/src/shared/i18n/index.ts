import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'

import { APP_LOCALES, DEFAULT_LOCALE, type AppLocale } from '@/shared/config/locale'
import en from '@/shared/i18n/locales/en.json'
import ru from '@/shared/i18n/locales/ru.json'
import uz from '@/shared/i18n/locales/uz.json'

const STORAGE_KEY = 'mw.locale'

const isAppLocale = (value: unknown): value is AppLocale =>
  typeof value === 'string' && (APP_LOCALES as readonly string[]).includes(value)

/** Saqlangan til → brauzer tili → o'zbekcha. */
function detectLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (isAppLocale(stored)) return stored
  const browser = navigator.language.slice(0, 2)
  return isAppLocale(browser) ? browser : DEFAULT_LOCALE
}

void i18n.use(initReactI18next).init({
  resources: { uz: { translation: uz }, ru: { translation: ru }, en: { translation: en } },
  lng: detectLocale(),
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.language

export function setLocale(locale: AppLocale): void {
  localStorage.setItem(STORAGE_KEY, locale)
  void i18n.changeLanguage(locale)
}

/** Joriy UI tili (formatlash funksiyalari uchun). */
export function useAppLocale(): AppLocale {
  const { i18n: instance } = useTranslation()
  return isAppLocale(instance.language) ? instance.language : DEFAULT_LOCALE
}

export { i18n }

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof uz }
  }
}
