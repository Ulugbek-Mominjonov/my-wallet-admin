import { z } from 'zod'

import type { Account } from '@/entities/account'
import { TRANSACTION_KINDS, type Transaction, type TransactionKind } from '@/entities/transaction'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'
import { isMonthKey } from '@/shared/lib/month'

/** `entity_name` va `note_text` domenlari (contracts/api.md). */
export const PAYEE_MAX = 60
export const NOTE_MAX = 1000

/** `save_transaction` kirishi — summalar hisob valyutasining eng kichik birligida. */
export interface TransactionInput {
  kind: TransactionKind
  accountId: string
  toAccountId: string | null
  amount: number
  toAmount: number | null
  categoryId: string | null
  payee: string | null
  occurredOn: string
  /** Qo'lda tanlangan oy (`YYYY-MM-01`, BR-042); `null` — qoida bo'yicha. */
  budgetMonth: string | null
  plannedItemId: string | null
  debtId: string | null
  note: string | null
  tagIds: string[]
}

/** Forma tekshiruvi uchun hisob ma'lumoti (valyuta va 👤 fond). */
export type AccountInfo = Pick<Account, 'currency' | 'type'>

const positive = (text: string, currency: string): number | null => {
  const value = text.trim() ? parseMoney(text, currency) : null
  return value !== null && value > 0 ? value : null
}

/**
 * E23-T02: amal formasi (BR-050..054, BR-062, BR-063, BR-193). Hisoblar
 * valyutasi sxemaga beriladi: summa shu valyutada o'qiladi, turli valyutali
 * o'tkazmada manzil summasi majburiy.
 */
export function transactionFormSchema(accountOf: (id: string) => AccountInfo | undefined) {
  return z
    .object({
      kind: z.enum(TRANSACTION_KINDS),
      amount: z.string(),
      accountId: z.string(),
      toAccountId: z.string(),
      toAmount: z.string(),
      categoryId: z.string(),
      occurredOn: z.iso.date(),
      manualMonth: z.boolean(),
      budgetMonth: z.string(),
      payee: z.string().trim().max(PAYEE_MAX),
      plannedItemId: z.string(),
      debtId: z.string(),
      note: z.string().trim().max(NOTE_MAX),
      tagIds: z.array(z.string()),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message = path) => {
        ctx.addIssue({ code: 'custom', path: [path], message })
      }
      const account = accountOf(v.accountId)
      if (!account) {
        issue('accountId')
        return
      }
      if (positive(v.amount, account.currency) === null) issue('amount')
      // BR-063: daromad fondga emas — byudjet hisobiga (fondga faqat ajratma).
      if (v.kind === 'income' && account.type === 'personal_fund') issue('accountId', 'fund')
      if (v.kind === 'transfer') {
        const target = accountOf(v.toAccountId)
        if (!target || v.toAccountId === v.accountId) issue('toAccountId')
        // BR-193: turli valyutada manzil summasi ham kiritiladi.
        else if (
          target.currency !== account.currency &&
          positive(v.toAmount, target.currency) === null
        ) {
          issue('toAmount')
        }
      } else if (
        v.categoryId === '' &&
        !(v.kind === 'expense' && account.type === 'personal_fund')
      ) {
        // BR-062: fonddan sarfda kategoriya ixtiyoriy ("O'zim uchun" — server).
        issue('categoryId')
      }
      if (v.manualMonth && !isMonthKey(v.budgetMonth)) issue('budgetMonth')
    })
    .transform((v): TransactionInput => {
      const account = accountOf(v.accountId)
      const target = v.kind === 'transfer' ? accountOf(v.toAccountId) : undefined
      const currency = account?.currency ?? ''
      return {
        kind: v.kind,
        accountId: v.accountId,
        toAccountId: v.kind === 'transfer' ? v.toAccountId : null,
        amount: positive(v.amount, currency) ?? 0,
        toAmount:
          target && target.currency !== currency ? positive(v.toAmount, target.currency) : null,
        categoryId: v.kind === 'transfer' || v.categoryId === '' ? null : v.categoryId,
        payee: v.payee || null,
        occurredOn: v.occurredOn,
        budgetMonth: v.manualMonth ? `${v.budgetMonth}-01` : null,
        plannedItemId: v.plannedItemId || null,
        // Qarz — faqat daromad/xarajatda (BR-111).
        debtId: v.kind === 'transfer' || v.debtId === '' ? null : v.debtId,
        note: v.note || null,
        tagIds: v.tagIds,
      }
    })
}

export type TransactionFormValues = z.input<ReturnType<typeof transactionFormSchema>>

export function transactionFormDefaults(
  transaction: Transaction | undefined,
  { today, currencyOf }: { today: string; currencyOf: (accountId: string) => string },
): TransactionFormValues {
  if (!transaction) {
    return {
      kind: 'expense',
      amount: '',
      accountId: '',
      toAccountId: '',
      toAmount: '',
      categoryId: '',
      occurredOn: today,
      manualMonth: false,
      budgetMonth: today.slice(0, 7),
      payee: '',
      plannedItemId: '',
      debtId: '',
      note: '',
      tagIds: [],
    }
  }
  const t = transaction
  return {
    kind: t.kind,
    amount: formatMoneyInput(t.amount, currencyOf(t.accountId)),
    accountId: t.accountId,
    toAccountId: t.toAccountId ?? '',
    toAmount:
      t.toAccountId === null || t.toAmount === null
        ? ''
        : formatMoneyInput(t.toAmount, currencyOf(t.toAccountId)),
    categoryId: t.categoryId ?? '',
    occurredOn: t.occurredOn,
    manualMonth: t.budgetMonthSource === 'manual',
    budgetMonth: t.budgetMonth.slice(0, 7),
    payee: t.payee ?? '',
    plannedItemId: t.plannedItemId ?? '',
    debtId: t.debtId ?? '',
    note: t.note ?? '',
    tagIds: t.tagIds,
  }
}
