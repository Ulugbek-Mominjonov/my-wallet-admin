import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { DashboardPage } from '@/features/reports'
import { healthCheckQuery } from '@/features/tools'
import { currentMonthKey } from '@/shared/lib/month'

/** E24-T01: byudjet xulosasi. Tekshiruv soni — `tools` feature'idan (marshrut birlashtiradi). */
export const Route = createFileRoute('/_app/h/$householdId/')({
  component: DashboardRoute,
})

function DashboardRoute() {
  const { household } = Route.useRouteContext()
  const health = useQuery(healthCheckQuery(household.id))
  return (
    <DashboardPage
      householdId={household.id}
      month={currentMonthKey(new Date(), household.timezone)}
      baseCurrency={household.base_currency}
      health={{
        problems: health.data?.problems.length ?? 0,
        warnings: health.data?.warnings.length ?? 0,
      }}
    />
  )
}
