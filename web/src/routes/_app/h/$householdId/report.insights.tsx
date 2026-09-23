import { createFileRoute } from '@tanstack/react-router'

import { InsightsPage, reportSearchSchema } from '@/features/reports'
import { currentMonthKey } from '@/shared/lib/month'

/** E32-T02: tahlillar — oy URL'da (oylik hisobot bilan bir xil). */
export const Route = createFileRoute('/_app/h/$householdId/report/insights')({
  validateSearch: reportSearchSchema,
  component: InsightsRoute,
})

function InsightsRoute() {
  const { household } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const currentMonth = currentMonthKey(new Date(), household.timezone)
  return (
    <InsightsPage
      householdId={household.id}
      month={search.month ?? currentMonth}
      currentMonth={currentMonth}
      onMonthChange={(month) => {
        void navigate({
          search: { month: month === currentMonth ? undefined : month },
          replace: true,
        })
      }}
      baseCurrency={household.base_currency}
    />
  )
}
