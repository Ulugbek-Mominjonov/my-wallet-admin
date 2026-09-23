import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { categoriesQuery } from '@/features/categories'
import { CategoryTrendPage, trendSearchSchema } from '@/features/reports'
import { currentMonthKey, shiftMonth } from '@/shared/lib/month'

/** E24-T05: kategoriya tahlili — davr va kategoriya URL'da. */
export const Route = createFileRoute('/_app/h/$householdId/report/categories')({
  validateSearch: trendSearchSchema,
  component: CategoryTrendRoute,
})

/** Standart davr — so'nggi 6 oy. */
const DEFAULT_MONTHS = 5

function CategoryTrendRoute() {
  const { household } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const categories = useQuery(categoriesQuery(household.id, { archived: true }))
  const currentMonth = currentMonthKey(new Date(), household.timezone)
  return (
    <CategoryTrendPage
      householdId={household.id}
      from={search.from ?? shiftMonth(currentMonth, -DEFAULT_MONTHS)}
      to={search.to ?? currentMonth}
      categoryId={search.category ?? null}
      onRangeChange={(range) => {
        void navigate({ search: (prev) => ({ ...prev, ...range }), replace: true })
      }}
      onCategoryChange={(category) => {
        void navigate({
          search: (prev) => ({ ...prev, category: category ?? undefined }),
          replace: true,
        })
      }}
      currentMonth={currentMonth}
      baseCurrency={household.base_currency}
      categories={categories.data ?? []}
    />
  )
}
