import { createFileRoute } from '@tanstack/react-router'

import { LegacyImportPage } from '@/features/tools'

/** E27-T04: eski Sheets byudjetini ko'chirish (BR-181). */
export const Route = createFileRoute('/_app/h/$householdId/legacy')({
  component: LegacyRoute,
})

function LegacyRoute() {
  const { household } = Route.useRouteContext()
  return <LegacyImportPage householdId={household.id} baseCurrency={household.base_currency} />
}
