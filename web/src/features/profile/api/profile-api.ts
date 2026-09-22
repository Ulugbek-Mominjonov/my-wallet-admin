import type { QueryClient } from '@tanstack/react-query'

import type { Bootstrap } from '@/entities/household'
import type { ProfileValues } from '@/features/profile/model/profile-form'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** Ism va til (bildirishnomalar ham shu tilda) — faqat ruxsat etilgan ustunlar. */
export async function updateProfile(userId: string, values: ProfileValues): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: values.displayName, locale: values.locale })
    .eq('user_id', userId)
  if (error) throw toAppError(error)
}

/** Keshdagi bootstrap profilini serverga so'rovsiz moslaydi. */
export function setCachedProfile(queryClient: QueryClient, values: ProfileValues): void {
  queryClient.setQueryData<Bootstrap>(
    qk.bootstrap(),
    (boot) =>
      boot && {
        ...boot,
        profile: { ...boot.profile, display_name: values.displayName, locale: values.locale },
      },
  )
}
