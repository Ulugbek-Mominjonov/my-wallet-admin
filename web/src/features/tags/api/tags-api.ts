import { queryOptions } from '@tanstack/react-query'

import type { Tag } from '@/entities/tag'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

export const tagsKey = (householdId: string) => [...qk.household(householdId), 'tags'] as const

export const tagsQuery = (householdId: string) =>
  queryOptions({
    queryKey: tagsKey(householdId),
    queryFn: async (): Promise<Tag[]> => {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .order('name')
      if (error) throw toAppError(error)
      return data
    },
  })

export interface TagInput {
  name: string
  color: string | null
}

/** Yaratish — member ham (tez kiritishda), tahrir/o'chirish — owner/admin. */
export async function createTag(householdId: string, input: TagInput): Promise<void> {
  const { error } = await supabase.from('tags').insert({ household_id: householdId, ...input })
  if (error) throw toAppError(error)
}

export async function updateTag(id: string, input: TagInput): Promise<void> {
  const { error } = await supabase.from('tags').update(input).eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase
    .from('tags')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}
