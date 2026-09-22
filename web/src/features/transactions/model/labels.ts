import type { Category } from '@/entities/category'
import type { Transaction } from '@/entities/transaction'

/** Qiymat yo'q (o'chirilgan spravochnik, ismsiz a'zo) — jadvalda chiziqcha. */
export const MISSING = '—'

/** Qator nomi (ekran o'quvchi, tasdiq oynasi): joy, bo'lmasa kategoriya yoki tur. */
export function transactionName(
  row: Transaction,
  category: Category | undefined,
  transferLabel: string,
): string {
  return row.payee ?? category?.name ?? (row.kind === 'transfer' ? transferLabel : MISSING)
}
