import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { accountsQuery } from '@/features/accounts'
import { SavingsReportPage } from '@/features/reports'
import { currentMonthKey } from '@/shared/lib/month'

/** E24-T04: jamg'arma, 👤 fond va hisoblar qoldig'i. */
export const Route = createFileRoute('/_app/h/$householdId/report/savings')({
  component: SavingsReportRoute,
})

function SavingsReportRoute() {
  const { household } = Route.useRouteContext()
  const accounts = useQuery(accountsQuery(household.id, { archived: false }))
  return (
    <SavingsReportPage
      householdId={household.id}
      currentMonth={currentMonthKey(new Date(), household.timezone)}
      baseCurrency={household.base_currency}
      accounts={accounts.data ?? []}
    />
  )
}
