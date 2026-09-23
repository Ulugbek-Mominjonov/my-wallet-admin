import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { HouseholdProvider, type Bootstrap } from '@/entities/household'
import { AppShell } from '@/features/app-shell'
import { bootstrapQuery, UserMenu } from '@/features/auth'
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
  const context = Route.useRouteContext()
  const { data: boot } = useSuspenseQuery(bootstrapQuery)
  // Jonli bootstrap'dan: nom yoki rol o'zgarsa (sozlamalar, egalik o'tkazish)
  // darhol ko'rinadi; marshrut konteksti faqat navigatsiyada yangilanadi.
  const household = boot.households.find((h) => h.id === context.household.id) ?? context.household
  const { email } = context
  useRememberHousehold(boot.profile, household.id)

  return (
    <HouseholdProvider household={household}>
      <AppShell
        householdId={household.id}
        role={household.role}
        switcher={<HouseholdSwitcher households={boot.households} current={household} />}
        platformAdmin={boot.is_platform_admin}
        userMenu={
          <UserMenu name={boot.profile.display_name} email={email} householdId={household.id} />
        }
      >
        <Outlet />
      </AppShell>
    </HouseholdProvider>
  )
}
