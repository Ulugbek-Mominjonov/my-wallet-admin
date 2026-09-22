import type { ReactNode } from 'react'

import type { HouseholdSummary } from './bootstrap'
import { HouseholdContext } from './household-context'

/** Joriy byudjet — `/h/$householdId` marshruti beradi (E21-T02). */
export function HouseholdProvider({
  household,
  children,
}: {
  household: HouseholdSummary
  children: ReactNode
}) {
  return <HouseholdContext value={household}>{children}</HouseholdContext>
}
