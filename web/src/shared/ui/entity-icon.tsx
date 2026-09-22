import { createElement, type ReactNode } from 'react'

import { iconFor } from '@/shared/config/icons'

/**
 * Neytral ikon kaliti bo'yicha Lucide ikoni (noma'lum — `dots`). Komponent
 * statik ro'yxatdan tanlanadi — render paytida yangi komponent yaratilmaydi.
 */
export function EntityIcon({ name, className }: { name: string | null; className?: string }) {
  return createElement(iconFor(name), { className, 'aria-hidden': true })
}

/** Rang foni shaffofligi (hex alfa, ~15%) — ikon rangi fonda ohista ko'rinadi. */
const TINT_ALPHA = '26'

/** Ikon uchun kvadrat: rang berilsa — shu rangda, aks holda neytral. */
export function IconTile({ color, children }: { color: string | null; children: ReactNode }) {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted [&_svg]:size-4"
      style={color ? { backgroundColor: `${color}${TINT_ALPHA}`, color } : undefined}
    >
      {children}
    </span>
  )
}

/** Spravochnik yozuvi ikoni (kalit bo'yicha) rangli kvadrat ichida. */
export function EntityIconTile({ name, color }: { name: string; color: string | null }) {
  return (
    <IconTile color={color}>
      <EntityIcon name={name} />
    </IconTile>
  )
}
