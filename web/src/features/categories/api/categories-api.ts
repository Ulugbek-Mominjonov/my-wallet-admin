import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import type { Category, CategoryKind } from '@/entities/category'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

const CATEGORY_COLUMNS =
  'id, kind, name, parent_id, month_shift, system_code, icon, color, sort_order, archived_at'

export const categoriesKey = (householdId: string) =>
  [...qk.household(householdId), 'categories'] as const

/**
 * E22-T03: ikkala tur bitta so'rovda (jadval kichik, tab almashganda qayta
 * so'rov yo'q) — `categories_name_key` indeksining `household_id` qismidan.
 */
export const categoriesQuery = (householdId: string, { archived }: { archived: boolean }) =>
  queryOptions({
    queryKey: [...categoriesKey(householdId), { archived }],
    queryFn: async (): Promise<Category[]> => {
      let query = supabase
        .from('categories')
        .select(CATEGORY_COLUMNS)
        .eq('household_id', householdId)
        .is('deleted_at', null)
      if (!archived) query = query.is('archived_at', null)
      const { data, error } = await query.order('sort_order').order('name')
      if (error) throw toAppError(error)
      return data.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name,
        parentId: row.parent_id,
        monthShift: row.month_shift,
        systemCode: row.system_code,
        icon: row.icon,
        color: row.color,
        sortOrder: row.sort_order,
        archivedAt: row.archived_at,
      }))
    },
  })

export interface CategoryInput {
  name: string
  parentId: string | null
  monthShift: number
  icon: string | null
  color: string | null
}

const toRow = (input: CategoryInput) => ({
  name: input.name,
  parent_id: input.parentId,
  month_shift: input.monthShift,
  icon: input.icon,
  color: input.color,
})

export async function createCategory(
  householdId: string,
  kind: CategoryKind,
  input: CategoryInput,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .insert({ household_id: householdId, kind, sort_order: sortOrder, ...toRow(input) })
  if (error) throw toAppError(error)
}

/** Tur (`kind`) o'zgarmaydi — faqat ruxsat etilgan ustunlar (contracts/api.md). */
export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  const { error } = await supabase.from('categories').update(toRow(input)).eq('id', id)
  if (error) throw toAppError(error)
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw toAppError(error)
}

/** Ishlatilayotgan kategoriya — `category_in_use` (arxivlang yoki birlashtiring). */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}

export async function reorderCategories(householdId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_sort_order', {
    p_household: householdId,
    p_table: 'categories',
    p_ids: ids,
  })
  if (error) throw toAppError(error)
}

const mergeResultSchema = z.object({
  children: z.number(),
  transactions: z.number(),
  plans: z.number(),
  recurring_rules: z.number(),
  quick_actions: z.number(),
})
export type MergeResult = z.infer<typeof mergeResultSchema>

/** BR-036: manbadagi hammasi maqsadga ko'chadi (bitta tranzaksiya), manba o'chadi. */
export async function mergeCategories(fromId: string, toId: string): Promise<MergeResult> {
  const { data, error } = await supabase.rpc('merge_categories', { p_from: fromId, p_to: toId })
  if (error) throw toAppError(error)
  return mergeResultSchema.parse(data)
}

const recalcPreviewSchema = z.object({
  count: z.number(),
  moves: z.array(
    z.object({
      from_month: z.string(),
      to_month: z.string(),
      count: z.number(),
      amount_base: z.number(),
    }),
  ),
})
export type RecalcPreview = z.infer<typeof recalcPreviewSchema>

/** BR-043: oy siljishi o'zgargach qaysi amallar qaysi oyga ko'chishi (qo'lda oylar tegmaydi). */
export async function recalcIncomeMonthsPreview(householdId: string): Promise<RecalcPreview> {
  const { data, error } = await supabase.rpc('recalc_income_months_preview', {
    p_household: householdId,
  })
  if (error) throw toAppError(error)
  return recalcPreviewSchema.parse(data)
}

/** Preview'dagi son bilan — oradagi o'zgarish bo'lsa `preview_outdated`. */
export async function recalcIncomeMonthsApply(
  householdId: string,
  expectedCount: number,
): Promise<void> {
  const { error } = await supabase.rpc('recalc_income_months_apply', {
    p_household: householdId,
    p_expected_count: expectedCount,
  })
  if (error) throw toAppError(error)
}
