import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { HouseholdProvider, type Bootstrap } from '@/entities/household'
import { AppShell } from '@/features/app-shell'
import { bootstrapQuery } from '@/features/auth'
import { HouseholdSwitcher, useRememberHousehold } from '@/features/household'
import { forbiddenError } from '@/shared/api/errors'

/**
 * E21-T02: byudjet konteksti URL prefiksidan (`/h/$householdId/...`) —
 * havolani ulashsa ham, yangi tabda ochsa ham to'g'ri byudjet ochiladi.
 */
export const Route = createFileRoute('/_app/h/$householdId')({
  beforeLoad: async ({ context, params }) => {
    const find = (boot: Bootstrap) => boot.households.find((h) => h.id === params.householdId)
    // Keshdagi ro'yxat eskirgan bo'lishi mumkin (boshqa qurilmada qo'shilgan) —
    // a'zolik topilmasa bir marta serverdan tekshiriladi.
    const household =
      find(context.boot) ??
      find(await context.queryClient.query({ ...bootstrapQuery, staleTime: 0 }))
    if (!household) throw forbiddenError()
    return { household }
  },
  component: HouseholdLayout,
})

function HouseholdLayout() {
  const { household } = Route.useRouteContext()
  const { data: boot } = useSuspenseQuery(bootstrapQuery)
  useRememberHousehold(boot.profile, household.id)

  return (
    <HouseholdProvider household={household}>
      <AppShell
        householdId={household.id}
        role={household.role}
        switcher={<HouseholdSwitcher households={boot.households} current={household} />}
      >
        <Outlet />
      </AppShell>
    </HouseholdProvider>
  )
}
