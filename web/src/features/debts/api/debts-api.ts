import { queryOptions } from '@tanstack/react-query'

import { Constants } from '@/shared/api/database.types'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** BR-110: `i_owe` — men qarzdorman, `owed_to_me` — menga qarzdor. */
export const DEBT_DIRECTIONS = Constants.public.Enums.debt_direction
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number]

/** BR-116: bog'lanmagan, kutilmoqda (reja bor), to'lanyapti, yopildi. */
export type DebtStatus = 'unlinked' | 'pending' | 'paying' | 'closed'

export interface Debt {
  id: string
  name: string
  direction: DebtDirection
  currency: string
  total: number
  paidBefore: number
  monthlyPayment: number | null
  dueDate: string | null
  note: string | null
  archivedAt: string | null
  /** `debt_balances` (BR-112, BR-113). */
  paidInApp: number
  pendingAmount: number
  remaining: number
  progress: number
  monthsLeft: number | null
  endMonth: string | null
  status: DebtStatus
}

export const debtsKey = (householdId: string) => [...qk.household(householdId), 'debts'] as const

const STATUSES: readonly string[] = ['unlinked', 'pending', 'paying', 'closed']
const toStatus = (value: string | null): DebtStatus =>
  value !== null && STATUSES.includes(value) ? (value as DebtStatus) : 'unlinked'

/** E22-T06: qarzlar va holati — ikki parallel so'rov (har qarz o'z indeksidan). */
export const debtsQuery = (householdId: string, { archived }: { archived: boolean }) =>
  queryOptions({
    queryKey: [...debtsKey(householdId), { archived }],
    queryFn: async (): Promise<Debt[]> => {
      let debts = supabase
        .from('debts')
        .select(
          'id, name, direction, currency, total, paid_before, monthly_payment, due_date, note, archived_at',
        )
        .eq('household_id', householdId)
        .is('deleted_at', null)
      if (!archived) debts = debts.is('archived_at', null)
      const [rows, balances] = await Promise.all([
        debts.order('name'),
        supabase
          .from('debt_balances')
          .select(
            'debt_id, paid_in_app, pending_amount, remaining, progress, months_left, end_month, status',
          )
          .eq('household_id', householdId),
      ])
      if (rows.error) throw toAppError(rows.error)
      if (balances.error) throw toAppError(balances.error)
      const balanceOf = new Map(balances.data.map((b) => [b.debt_id, b]))
      return rows.data.map((row) => {
        const b = balanceOf.get(row.id)
        return {
          id: row.id,
          name: row.name,
          direction: row.direction,
          currency: row.currency,
          total: row.total,
          paidBefore: row.paid_before,
          monthlyPayment: row.monthly_payment,
          dueDate: row.due_date,
          note: row.note,
          archivedAt: row.archived_at,
          paidInApp: b?.paid_in_app ?? 0,
          pendingAmount: b?.pending_amount ?? 0,
          remaining: b?.remaining ?? row.total - row.paid_before,
          progress: b?.progress ?? row.paid_before / row.total,
          monthsLeft: b?.months_left ?? null,
          endMonth: b?.end_month ?? null,
          status: toStatus(b?.status ?? null),
        }
      })
    },
  })

export interface DebtInput {
  name: string
  direction: DebtDirection
  currency: string
  total: number
  paidBefore: number
  monthlyPayment: number | null
  dueDate: string | null
  note: string | null
}

/** Yo'nalish va valyuta yaratilgandan keyin o'zgarmaydi (ustun grant'lari, BR-111/194). */
const toUpdate = (input: DebtInput) => ({
  name: input.name,
  total: input.total,
  paid_before: input.paidBefore,
  monthly_payment: input.monthlyPayment,
  due_date: input.dueDate,
  note: input.note,
})

export async function createDebt(householdId: string, input: DebtInput): Promise<void> {
  const { error } = await supabase.from('debts').insert({
    household_id: householdId,
    direction: input.direction,
    currency: input.currency,
    ...toUpdate(input),
  })
  if (error) throw toAppError(error)
}

export async function updateDebt(id: string, input: DebtInput): Promise<void> {
  const { error } = await supabase.from('debts').update(toUpdate(input)).eq('id', id)
  if (error) throw toAppError(error)
}

export async function setDebtArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw toAppError(error)
}

/** Amal/reja bog'langan qarz — `debt_in_use` (arxivlang). */
export async function deleteDebt(id: string): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}
