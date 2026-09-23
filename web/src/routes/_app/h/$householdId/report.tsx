import { createFileRoute } from '@tanstack/react-router'

import { MonthReportPage, reportSearchSchema } from '@/features/reports'
import { currentMonthKey } from '@/shared/lib/month'

/** E24-T02: oylik hisobot — oy URL'da (ulashiladigan havola). */
export const Route = createFileRoute('/_app/h/$householdId/report')({
  validateSearch: reportSearchSchema,
  component: MonthReportRoute,
})

function MonthReportRoute() {
  const { household } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const currentMonth = currentMonthKey(new Date(), household.timezone)
  return (
    <MonthReportPage
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
