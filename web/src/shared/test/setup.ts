import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import { DEFAULT_LOCALE } from '@/shared/config/locale'
import { setLocale } from '@/shared/i18n'
import { server } from '@/shared/test/msw'

// jsdom'da yo'q — toast/tema kutubxonalari `prefers-color-scheme` ni so'raydi.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList,
})

// Kutilmagan tarmoq so'rovi — test xatosi (har so'rov aniq handler bilan).
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterAll(() => {
  server.close()
})

// jsdom brauzer tili en-US — testlar standart til (uz) bilan boshlanadi.
beforeEach(() => {
  setLocale(DEFAULT_LOCALE)
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Supabase sessiyasi localStorage'da — testlar orasida qolmasin.
  localStorage.clear()
})
