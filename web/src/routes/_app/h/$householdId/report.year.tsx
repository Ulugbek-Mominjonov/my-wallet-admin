import { createFileRoute } from '@tanstack/react-router'

import { YearReportPage, yearSearchSchema } from '@/features/reports'

/** E24-T03: yillik ko'rinish — yil URL'da. */
export const Route = createFileRoute('/_app/h/$householdId/report/year')({
  validateSearch: yearSearchSchema,
  component: YearReportRoute,
})

function YearReportRoute() {
  const { household } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const currentYear = new Date().getFullYear()
  return (
    <YearReportPage
      householdId={household.id}
      year={search.year ?? currentYear}
      currentYear={currentYear}
      onYearChange={(year) => {
        void navigate({ search: { year: year === currentYear ? undefined : year }, replace: true })
      }}
      baseCurrency={household.base_currency}
    />
  )
}
