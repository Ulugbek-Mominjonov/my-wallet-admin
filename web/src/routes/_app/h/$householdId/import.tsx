import { createFileRoute } from '@tanstack/react-router'

import { ImportPage } from '@/features/tools'

/** E25-T03: bank ko'chirmasidan CSV import (BR-182). */
export const Route = createFileRoute('/_app/h/$householdId/import')({
  component: ImportRoute,
})

function ImportRoute() {
  const { household } = Route.useRouteContext()
  return <ImportPage householdId={household.id} baseCurrency={household.base_currency} />
}
