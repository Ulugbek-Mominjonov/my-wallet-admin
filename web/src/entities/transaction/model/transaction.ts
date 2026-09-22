import { Constants } from '@/shared/api/database.types'
import { shiftMonth, type MonthKey } from '@/shared/lib/month'

/** BR-050: amal turlari — xarajat, daromad, o'tkazma. */
export const TRANSACTION_KINDS = Constants.public.Enums.transaction_kind
export type TransactionKind = (typeof TRANSACTION_KINDS)[number]

export interface Transaction {
  id: string
  kind: TransactionKind
  accountId: string
  /** Faqat o'tkazmada — manzil hisob. */
  toAccountId: string | null
  /** Hisob valyutasida, eng kichik birlikda (BR-001). */
  amount: number
  toAmount: number | null
  /** Asosiy valyutada (BR-191) — jami va filtr shu bo'yicha. */
  amountBase: number
  categoryId: string | null
  payee: string | null
  occurredOn: string
  /** Tegishli oy (`YYYY-MM-01`, BR-040..045). */
  budgetMonth: string
  /** `manual` — foydalanuvchi tanlagan (BR-042), aks holda qoida bo'yicha. */
  budgetMonthSource: 'auto' | 'manual'
  plannedItemId: string | null
  debtId: string | null
  note: string | null
  createdBy: string | null
  tagIds: string[]
  hasReceipt: boolean
}

/**
 * Tegishli oy qoidasi (BR-040, BR-041, BR-044, BR-046) — server triggeri
 * bilan bir xil tartib: reja oyi → daromad (sana oyi + kategoriya siljishi) →
 * sana oyi. Formada jonli ko'rsatish uchun (BR-045); yozuvda server hisoblaydi.
 */
export function autoBudgetMonth({
  kind,
  occurredOn,
  monthShift,
  planMonth,
}: {
  kind: TransactionKind
  occurredOn: string
  /** Daromad kategoriyasining siljishi (0 yoki −1). */
  monthShift: number
  /** Bog'langan reja oyi (`YYYY-MM`). */
  planMonth: MonthKey | null
}): MonthKey {
  if (planMonth !== null) return planMonth
  const month = shiftMonth(occurredOn.slice(0, 7), 0)
  return kind === 'income' ? shiftMonth(month, monthShift) : month
}
