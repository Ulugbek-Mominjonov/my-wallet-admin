import { createContext, useContext } from 'react'

import { roleCan, type HouseholdSummary, type Permission } from './bootstrap'

export const HouseholdContext = createContext<HouseholdSummary | null>(null)

export function useHousehold(): HouseholdSummary {
  const household = useContext(HouseholdContext)
  if (!household) throw new Error('useHousehold: HouseholdProvider tashqarisida')
  return household
}

/** BR-011: joriy roldagi huquq (masalan `viewer` — tugmalar o'chiq). */
export function useCan(permission: Permission): boolean {
  return roleCan(useHousehold().role, permission)
}
