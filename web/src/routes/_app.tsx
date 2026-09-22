import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { assuranceLevel, bootstrapQuery, currentSession, mfaGate } from '@/features/auth'

/**
 * Ichki sahifalar: faqat kirganlar uchun (E21-T01); 2FA yoqqan foydalanuvchi
 * avval kodni kiritadi (E21-T04). Profil, byudjetlar va rollar
 * (`app_bootstrap`) shu yerda yuklanadi va ichki marshrutlarga beriladi.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const session = await currentSession()
    if (!session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (mfaGate(await assuranceLevel(), { required: false }) === 'challenge') {
      throw redirect({ to: '/mfa', search: { redirect: location.href } })
    }
    return {
      boot: await context.queryClient.query(bootstrapQuery),
      email: session.user.email ?? '',
    }
  },
  component: Outlet,
})
