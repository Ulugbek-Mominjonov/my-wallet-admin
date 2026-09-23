import { createFileRoute } from '@tanstack/react-router'

import { RecalcPage } from '@/features/categories'

/** E25-T04: daromad oyi qoidasini qayta qo'llash (BR-043). */
export const Route = createFileRoute('/_app/h/$householdId/recalc')({
  component: RecalcRoute,
})

function RecalcRoute() {
  const { household } = Route.useRouteContext()
  return <RecalcPage householdId={household.id} baseCurrency={household.base_currency} />
}
