import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { supabase } from '@/shared/api/supabase'

/** Eksport fayli shu hajmdan katta bo'lsa — bo'lib yuborish kerak (so'rov chegarasi). */
export const LEGACY_MAX_BYTES = 8 * 1024 * 1024

const monthSchema = z.object({
  month: z.iso.date(),
  legacy: z.object({ balance: z.number(), saved: z.number() }),
  current: z.object({ balance: z.number(), saved: z.number() }),
  diff: z.object({ balance: z.number(), saved: z.number() }),
})

const resultSchema = z.object({
  batch: z.string(),
  dry_run: z.boolean(),
  counts: z.object({
    incomes: z.number(),
    expenses: z.number(),
    plans: z.number(),
    allocations: z.number(),
    fund_spends: z.number(),
  }),
  warnings: z.array(z.object({ code: z.string(), name: z.string().nullable() })),
  months: z.array(monthSchema),
})

export type LegacyResult = z.infer<typeof resultSchema>
export type LegacyMonth = z.infer<typeof monthSchema>

/** E27-T03 (BR-181): eski v1 eksportini ko'chirish; `dryRun` da yozilmaydi. */
export async function importLegacy(
  householdId: string,
  payload: unknown,
  dryRun: boolean,
): Promise<LegacyResult> {
  const { data, error } = await supabase.rpc('import_legacy_v1', {
    p_household: householdId,
    p_payload: payload as never,
    p_dry_run: dryRun,
  })
  if (error) throw toAppError(error)
  return resultSchema.parse(data)
}
