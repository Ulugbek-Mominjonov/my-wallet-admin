import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { accountsQuery } from '@/features/accounts'
import { bootstrapQuery } from '@/features/auth'
import { SettingsPage } from '@/features/household-settings'
import { currentMonthKey } from '@/shared/lib/month'

/** E22-T07: byudjet sozlamalari (hisoblar — 👤 fond manbai tanlovi uchun). */
export const Route = createFileRoute('/_app/h/$householdId/settings')({
  component: SettingsRoute,
})

/** Asosiy valyuta ma'lumotnomada bo'lmasa — so'mdagi standart birlik (1000 so'm). */
const DEFAULT_ALLOCATION_UNIT = 100000

function SettingsRoute() {
  const { household } = Route.useRouteContext()
  const { data: boot } = useSuspenseQuery(bootstrapQuery)
  const accounts = useQuery(accountsQuery(household.id, { archived: false }))
  const unit =
    boot.currencies.find((c) => c.code === household.base_currency)?.allocation_rounding ??
    DEFAULT_ALLOCATION_UNIT
  return (
    <SettingsPage
      householdId={household.id}
      userId={boot.profile.user_id}
      role={household.role}
      month={`${currentMonthKey(new Date(), household.timezone)}-01`}
      accounts={(accounts.data ?? [])
        .filter((a) => a.type !== 'personal_fund')
        .map((a) => ({ value: a.id, label: a.name }))}
      allocationUnit={unit}
    />
  )
}
