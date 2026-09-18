import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

import { DEFAULT_LOCALE } from '@/shared/config/locale'
import { setLocale } from '@/shared/i18n'

// jsdom brauzer tili en-US — testlar standart til (uz) bilan boshlanadi.
beforeEach(() => {
  setLocale(DEFAULT_LOCALE)
})

afterEach(() => {
  cleanup()
})
