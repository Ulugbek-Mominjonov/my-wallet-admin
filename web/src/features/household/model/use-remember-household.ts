import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { Bootstrap } from '@/entities/household'
import { rememberHousehold, setLastHousehold } from '@/features/household/api/household-api'

/** Ochilgan byudjet profilga yoziladi — keyingi kirishda shu ochiladi (E21-T02). */
export function useRememberHousehold(profile: Bootstrap['profile'], householdId: string): void {
  const queryClient = useQueryClient()
  const { mutate } = useMutation({
    mutationFn: (id: string) => rememberHousehold(profile.user_id, id),
    onSuccess: (_, id) => {
      setLastHousehold(queryClient, id)
    },
  })
  useEffect(() => {
    if (profile.last_household_id !== householdId) mutate(householdId)
  }, [profile.last_household_id, householdId, mutate])
}
