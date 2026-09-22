import { queryOptions } from '@tanstack/react-query'

import type { Account, AccountType } from '@/entities/account'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** Faqat ro'yxat va forma uchun kerakli ustunlar. */
const ACCOUNT_COLUMNS =
  'id, name, type, currency, opening_balance, opening_date, icon, color, sort_order, archived_at'

/** Byudjet hisoblari (arxiv filtridan qat'i nazar) — invalidatsiya prefiksi. */
export const accountsKey = (householdId: string) =>
  [...qk.household(householdId), 'accounts'] as const

/**
 * E22-T02: hisoblar va joriy qoldiqlar — ikki parallel so'rov (ikkalasi
 * `household_id` indeksidan; qoldiq har hisob uchun o'z indeksidan).
 */
export const accountsQuery = (householdId: string, { archived }: { archived: boolean }) =>
  queryOptions({
    queryKey: [...accountsKey(householdId), { archived }],
    queryFn: async (): Promise<Account[]> => {
      let accounts = supabase
        .from('accounts')
        .select(ACCOUNT_COLUMNS)
        .eq('household_id', householdId)
        .is('deleted_at', null)
      if (!archived) accounts = accounts.is('archived_at', null)
      const [rows, balances] = await Promise.all([
        accounts.order('sort_order').order('name'),
        supabase
          .from('account_balances')
          .select('account_id, balance')
          .eq('household_id', householdId),
      ])
      if (rows.error) throw toAppError(rows.error)
      if (balances.error) throw toAppError(balances.error)
      const balanceOf = new Map(balances.data.map((b) => [b.account_id, b.balance]))
      return rows.data.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        currency: row.currency,
        openingBalance: row.opening_balance,
        openingDate: row.opening_date,
        icon: row.icon,
        color: row.color,
        sortOrder: row.sort_order,
        archivedAt: row.archived_at,
        balance: balanceOf.get(row.id) ?? row.opening_balance,
      }))
    },
  })

export interface AccountInput {
  name: string
  type: AccountType
  currency: string
  openingBalance: number
  openingDate: string
  icon: string | null
  color: string | null
}

const toRow = (input: AccountInput) => ({
  name: input.name,
  type: input.type,
  currency: input.currency,
  opening_balance: input.openingBalance,
  opening_date: input.openingDate,
  icon: input.icon,
  color: input.color,
})

/** Yangi hisob ro'yxat oxiriga ([sortOrder]). */
export async function createAccount(
  householdId: string,
  input: AccountInput,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .insert({ household_id: householdId, sort_order: sortOrder, ...toRow(input) })
  if (error) throw toAppError(error)
}

export async function updateAccount(id: string, input: AccountInput): Promise<void> {
  const { error } = await supabase.from('accounts').update(toRow(input)).eq('id', id)
  if (error) throw toAppError(error)
}

/** BR-024: arxiv — tanlash ro'yxatlarida yo'q, hisobotlarda bor. */
export async function setAccountArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw toAppError(error)
}

/** Soft delete (sinxron tombstone); ishlatilayotgan hisob — `account_in_use`. */
export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}

export async function reorderAccounts(householdId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_sort_order', {
    p_household: householdId,
    p_table: 'accounts',
    p_ids: ids,
  })
  if (error) throw toAppError(error)
}
