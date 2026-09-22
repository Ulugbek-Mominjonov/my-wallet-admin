import { createElement } from 'react'

import { iconFor } from '@/shared/config/icons'

/**
 * Neytral ikon kaliti bo'yicha Lucide ikoni (noma'lum — `dots`). Komponent
 * statik ro'yxatdan tanlanadi — render paytida yangi komponent yaratilmaydi.
 */
export function EntityIcon({ name, className }: { name: string | null; className?: string }) {
  return createElement(iconFor(name), { className, 'aria-hidden': true })
}
