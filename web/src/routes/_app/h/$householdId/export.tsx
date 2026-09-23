import { createFileRoute } from '@tanstack/react-router'

import { ExportPage } from '@/features/tools'
import { currentMonthKey } from '@/shared/lib/month'

/** E25-T02: zaxira va jadval eksporti. */
export const Route = createFileRoute('/_app/h/$householdId/export')({
  component: ExportRoute,
})

function ExportRoute() {
  const { household } = Route.useRouteContext()
  return (
    <ExportPage
      householdId={household.id}
      householdName={household.name}
      currentMonth={currentMonthKey(new Date(), household.timezone)}
    />
  )
}
