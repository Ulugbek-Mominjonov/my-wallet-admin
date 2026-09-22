import type { Account } from '@/entities/account'
import type { Category } from '@/entities/category'
import type { Tag } from '@/entities/tag'
import type { Transaction } from '@/entities/transaction'

/** Jadval va eksport uchun ID → yozuv xaritalari (har qatorda qidiruv O(1)). */
export interface TransactionLookup {
  accounts: ReadonlyMap<string, Account>
  categories: ReadonlyMap<string, Category>
  tags: ReadonlyMap<string, Tag>
  members: ReadonlyMap<string, string>
}

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
