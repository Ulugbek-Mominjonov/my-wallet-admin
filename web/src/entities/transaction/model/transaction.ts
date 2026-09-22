import { Constants } from '@/shared/api/database.types'

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
  plannedItemId: string | null
  debtId: string | null
  note: string | null
  createdBy: string | null
  tagIds: string[]
  hasReceipt: boolean
}
