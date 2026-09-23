import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

export interface BarListItem {
  key: string
  label: ReactNode
  /** Solishtiriladigan qiymat (manfiy bo'lmagan). */
  value: number
  /** Qiymatning o'qiladigan ko'rinishi (summa, ulush). */
  text: string
  /** Bosilsa — tafsilotga o'tish (masalan kategoriya amallari). */
  onSelect?: () => void
}

/**
 * Kattaliklarni solishtirish uchun gorizontal ustunlar — bitta rang
 * (uzunlik o'lchov, rang belgilovchi emas). Nomlar uzun bo'lgani uchun
 * gorizontal: donut/pie o'rniga (o'qish aniqroq).
 */
export function BarList({ items, total }: { items: readonly BarListItem[]; total: number }) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const row = (
          <>
            <span className="flex min-w-0 items-center justify-between gap-3 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {item.text}
                {total > 0 && ` · ${String(Math.round((item.value / total) * 100))}%`}
              </span>
            </span>
            <span aria-hidden className="mt-1 block h-2 rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-chart-1"
                style={{ width: `${String(Math.max((item.value / max) * 100, 2))}%` }}
              />
            </span>
          </>
        )
        return (
          <li key={item.key}>
            {item.onSelect ? (
              <button
                type="button"
                onClick={item.onSelect}
                className={cn(
                  'block w-full rounded-md p-1 text-left transition-colors',
                  'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                )}
              >
                {row}
              </button>
            ) : (
              <div className="p-1">{row}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
