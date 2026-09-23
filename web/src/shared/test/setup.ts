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

// jsdom'da yo'q — cmdk ro'yxati balandligini kuzatadi, grafiklar konteyner
// kengligini o'lchaydi. jsdom hamma o'lchamni 0 qaytargani uchun kuzatuvchi
// bir marta shu kenglikni beradi — aks holda grafik umuman chizilmaydi.
const TEST_ELEMENT_WIDTH = 640
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: { width: TEST_ELEMENT_WIDTH, height: 240 },
          } as ResizeObserverEntry,
        ],
        this,
      )
    }
    unobserve = () => undefined
    disconnect = () => undefined
  },
})
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: () => undefined,
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
