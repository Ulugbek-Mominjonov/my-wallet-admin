import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { bootstrapQuery, currentSession } from '@/features/auth'

/**
 * Ichki sahifalar: faqat kirganlar uchun (E21-T01); profil, byudjetlar va
 * rollar (`app_bootstrap`) shu yerda yuklanadi va ichki marshrutlarga beriladi.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    if (!(await currentSession())) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { boot: await context.queryClient.query(bootstrapQuery) }
  },
  component: Outlet,
})
