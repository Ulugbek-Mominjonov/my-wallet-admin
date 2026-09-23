import { createFileRoute } from '@tanstack/react-router'

import { ObligationsReportPage } from '@/features/reports'

/** E24-T04: qarzlar va maqsadlar hisoboti. */
export const Route = createFileRoute('/_app/h/$householdId/report/obligations')({
  component: ObligationsReportRoute,
})

function ObligationsReportRoute() {
  const { household } = Route.useRouteContext()
  return <ObligationsReportPage householdId={household.id} baseCurrency={household.base_currency} />
}
