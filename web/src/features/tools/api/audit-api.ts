import { infiniteQueryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** Bir sahifadagi yozuvlar (RPC chegarasi — 200). */
export const AUDIT_PAGE_SIZE = 50

export interface AuditFilters {
  tables: readonly string[]
  actors: readonly string[]
  from?: string
  to?: string
}

export const AUDIT_ACTIONS = ['insert', 'update', 'delete'] as const

const entrySchema = z.object({
  id: z.number(),
  at: z.string(),
  actor_id: z.string().nullable(),
  table_name: z.string(),
  record_id: z.string().nullable(),
  action: z.enum(AUDIT_ACTIONS),
  old_values: z.record(z.string(), z.unknown()).nullable(),
  new_values: z.record(z.string(), z.unknown()).nullable(),
})

export type AuditEntry = z.infer<typeof entrySchema>

export const auditKey = (householdId: string) => [...qk.household(householdId), 'audit'] as const

/** Keyset kursori — oxirgi yozuvning (vaqti, id) si. */
interface Cursor {
  at: string
  id: number
}

const nextCursor = (page: readonly AuditEntry[]): Cursor | null => {
  const last = page.at(-1)
  if (page.length < AUDIT_PAGE_SIZE || last === undefined) return null
  return { at: last.at, id: last.id }
}

const empty = (list: readonly string[]) => (list.length === 0 ? undefined : [...list])

async function fetchPage(
  householdId: string,
  filters: AuditFilters,
  cursor: Cursor | null,
): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc('audit_list', {
    p_household: householdId,
    p_tables: empty(filters.tables),
    p_actors: empty(filters.actors),
    p_from: filters.from,
    p_to: filters.to,
    p_after_at: cursor?.at,
    p_after_id: cursor?.id,
    p_limit: AUDIT_PAGE_SIZE,
  })
  if (error) throw toAppError(error)
  return z.array(entrySchema).parse(data)
}

/**
 * E25-T05 (BR-008): audit jurnali — keyset sahifalar (`at, id` kamayishi).
 * Filtr kalit ichida: har filtr o'z keshiga ega.
 */
export const auditQuery = (householdId: string, filters: AuditFilters) =>
  infiniteQueryOptions({
    queryKey: [...auditKey(householdId), filters],
    initialPageParam: null as Cursor | null,
    queryFn: ({ pageParam }) => fetchPage(householdId, filters, pageParam),
    getNextPageParam: nextCursor,
  })
