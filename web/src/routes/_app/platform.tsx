import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { pickHousehold } from '@/entities/household'
import { assuranceLevel, bootstrapQuery, mfaGate, UserMenu } from '@/features/auth'
import { PlatformShell } from '@/features/platform'
import { forbiddenError } from '@/shared/api/errors'

/**
 * E26 (BR-213): super-admin bo'limi — faqat `platform_admins` va 2FA
 * tasdiqlangan sessiya (server RLS ham shuni talab qiladi; bu yerda —
 * tushunarli yo'naltirish).
 */
export const Route = createFileRoute('/_app/platform')({
  beforeLoad: async ({ context, location }) => {
    const gate = mfaGate(await assuranceLevel(), { required: true })
    if (gate === 'challenge') {
      throw redirect({ to: '/mfa', search: { redirect: location.href } })
    }
    const household = pickHousehold(context.boot)
    if (gate === 'enroll') {
      // 2FA hali yoqilmagan — profil sahifasida yoqiladi.
      if (!household) throw forbiddenError()
      throw redirect({ to: '/h/$householdId/profile', params: { householdId: household.id } })
    }
    // Bootstrap 2FA'dan oldin olingan bo'lishi mumkin: `is_platform_admin`
    // aal2 talab qiladi, shuning uchun bir marta qayta so'raladi.
    const boot = context.boot.is_platform_admin
      ? context.boot
      : await context.queryClient.query({ ...bootstrapQuery, staleTime: 0 })
    if (!boot.is_platform_admin) throw forbiddenError()
    return { email: context.email }
  },
  component: PlatformLayout,
})

function PlatformLayout() {
  const { email } = Route.useRouteContext()
  const { data: boot } = useSuspenseQuery(bootstrapQuery)
  const household = pickHousehold(boot)

  return (
    <PlatformShell
      householdId={household?.id ?? null}
      userMenu={
        <UserMenu
          name={boot.profile.display_name}
          email={email}
          householdId={household?.id ?? ''}
        />
      }
    >
      <Outlet />
    </PlatformShell>
  )
}
