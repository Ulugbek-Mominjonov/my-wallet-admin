// Faqat testlar uchun — ilova kodi buni import qilmaydi.
import type { ReactNode } from 'react'

import { HouseholdProvider } from '@/entities/household/model/household-provider'
import type { Role } from '@/entities/household/model/bootstrap'
import { Toaster } from '@/shared/ui/sonner'

export const TEST_HOUSEHOLD_ID = '0198f000-0000-7000-8000-00000000000a'

/** Sahifa testlari uchun: byudjet konteksti (rol bilan) va toast'lar. */
export function WithHousehold({ role = 'owner', children }: { role?: Role; children: ReactNode }) {
  return (
    <HouseholdProvider
      household={{
        id: TEST_HOUSEHOLD_ID,
        name: 'Uy',
        role,
        base_currency: 'UZS',
        timezone: 'Asia/Tashkent',
        onboarded: true,
      }}
    >
      {children}
      <Toaster />
    </HouseholdProvider>
  )
}
