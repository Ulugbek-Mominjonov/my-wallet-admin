import { createFileRoute } from '@tanstack/react-router'

import { HealthPage } from '@/features/tools'

/** E25-T01: byudjet tekshiruvi. */
export const Route = createFileRoute('/_app/h/$householdId/health')({
  component: HealthRoute,
})

function HealthRoute() {
  const { household } = Route.useRouteContext()
  return <HealthPage householdId={household.id} baseCurrency={household.base_currency} />
}
