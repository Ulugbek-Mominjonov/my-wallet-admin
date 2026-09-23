import { createFileRoute } from '@tanstack/react-router'

import { DashboardPage } from '@/features/reports'
import { currentMonthKey } from '@/shared/lib/month'

/** E24-T01: byudjet xulosasi — joriy oy ko'rsatkichlari va grafiklar. */
export const Route = createFileRoute('/_app/h/$householdId/')({
  component: DashboardRoute,
})

function DashboardRoute() {
  const { household } = Route.useRouteContext()
  return (
    <DashboardPage
      householdId={household.id}
      month={currentMonthKey(new Date(), household.timezone)}
      baseCurrency={household.base_currency}
    />
  )
}
