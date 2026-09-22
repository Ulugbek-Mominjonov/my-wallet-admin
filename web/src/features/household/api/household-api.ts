import type { QueryClient } from '@tanstack/react-query'

import type { Bootstrap } from '@/entities/household'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** `create_household` — yaratuvchi owner bo'ladi; yangi byudjet ID si. */
export async function createHousehold(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_household', { p_name: name })
  if (error) throw toAppError(error)
  return data
}

/** `accept_invite` — kod registrsiz (server `upper` qiladi); byudjet ID si. */
export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invite', { p_code: code })
  if (error) throw toAppError(error)
  return data
}

/** Oxirgi tanlangan byudjet — keyingi kirishda shu ochiladi. */
export async function rememberHousehold(userId: string, householdId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ last_household_id: householdId })
    .eq('user_id', userId)
  if (error) throw toAppError(error)
}

/** Keshdagi bootstrap'ni serverga so'rovsiz moslaydi (profil yangilangandan keyin). */
export function setLastHousehold(queryClient: QueryClient, householdId: string): void {
  queryClient.setQueryData<Bootstrap>(
    qk.bootstrap(),
    (boot) => boot && { ...boot, profile: { ...boot.profile, last_household_id: householdId } },
  )
}

/** Byudjetlar ro'yxati o'zgardi (yaratish/qo'shilish) — bootstrap qayta olinadi. */
export async function refreshBootstrap(queryClient: QueryClient): Promise<void> {
  await queryClient.refetchQueries({ queryKey: qk.bootstrap(), exact: true })
}
