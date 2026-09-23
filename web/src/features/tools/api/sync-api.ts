import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** Jurnal sahifasidagi yozuvlar soni. */
export const SYNC_PAGE_SIZE = 50

export const SYNC_STATUSES = ['ok', 'conflict', 'rejected'] as const
export type SyncStatus = (typeof SYNC_STATUSES)[number]

const deviceSchema = z.object({
  user_id: z.string(),
  platform: z.string(),
  app_version: z.string().nullable(),
  last_seen_at: z.string(),
})

const deviceSyncSchema = z.object({
  user_id: z.string().nullable(),
  device_id: z.string(),
  last_sync_at: z.string(),
  ok: z.number(),
  conflicts: z.number(),
  rejected: z.number(),
})

const devicesSchema = z.object({
  devices: z.array(deviceSchema),
  sync: z.array(deviceSyncSchema),
})

export type Devices = z.infer<typeof devicesSchema>
export type Device = z.infer<typeof deviceSchema>
export type DeviceSync = z.infer<typeof deviceSyncSchema>

export const devicesKey = (householdId: string) =>
  [...qk.household(householdId), 'devices'] as const

/** E25-T07: a'zolar qurilmalari (tokensiz) va qurilma bo'yicha sinxron holati. */
export const devicesQuery = (householdId: string) =>
  queryOptions({
    queryKey: devicesKey(householdId),
    queryFn: async (): Promise<Devices> => {
      const { data, error } = await supabase.rpc('household_devices', { p_household: householdId })
      if (error) throw toAppError(error)
      return devicesSchema.parse(data)
    },
  })

const journalRowSchema = z.object({
  mutation_id: z.string(),
  user_id: z.string().nullable(),
  device_id: z.string(),
  table_name: z.string(),
  record_id: z.string(),
  status: z.enum(SYNC_STATUSES),
  code: z.string().nullable(),
  applied_at: z.string(),
})

export type SyncEntry = z.infer<typeof journalRowSchema>

export const syncJournalKey = (householdId: string) =>
  [...devicesKey(householdId), 'journal'] as const

/** Keyset kursori — oxirgi qatorning (vaqti, mutatsiya id) si. */
interface Cursor {
  at: string
  id: string
}

const nextCursor = (page: readonly SyncEntry[]): Cursor | null => {
  const last = page.at(-1)
  if (page.length < SYNC_PAGE_SIZE || last === undefined) return null
  return { at: last.applied_at, id: last.mutation_id }
}

async function fetchPage(
  householdId: string,
  statuses: readonly SyncStatus[],
  cursor: Cursor | null,
): Promise<SyncEntry[]> {
  // Butun `result` (to'qnashuvda — server qatori) tortilmaydi: faqat sabab kodi.
  let query = supabase
    .from('sync_mutations')
    .select(
      'mutation_id, user_id, device_id, table_name, record_id, status, applied_at, code:result->>code',
    )
    .eq('household_id', householdId)
    .in('status', [...statuses])
  if (cursor !== null) {
    // Keyset (applied_at, mutation_id) kamayishi — bir vaqtli qatorlar uchun ham.
    query = query.or(
      `applied_at.lt.${cursor.at},and(applied_at.eq.${cursor.at},mutation_id.lt.${cursor.id})`,
    )
  }
  const { data, error } = await query
    .order('applied_at', { ascending: false })
    .order('mutation_id', { ascending: false })
    .limit(SYNC_PAGE_SIZE)
  if (error) throw toAppError(error)
  return z.array(journalRowSchema).parse(data)
}

/** ARXITEKTURA 6: to'qnashuv va rad etish jurnali (30 kun saqlanadi). */
export const syncJournalQuery = (householdId: string, statuses: readonly SyncStatus[]) =>
  infiniteQueryOptions({
    queryKey: [...syncJournalKey(householdId), statuses],
    initialPageParam: null as Cursor | null,
    queryFn: ({ pageParam }) => fetchPage(householdId, statuses, pageParam),
    getNextPageParam: nextCursor,
  })
