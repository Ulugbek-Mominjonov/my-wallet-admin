import { createFileRoute, redirect } from '@tanstack/react-router'

import { pickHousehold } from '@/entities/household'

/** `/` — oxirgi tanlangan (yoki birinchi) byudjet; byudjet yo'q bo'lsa — sozlash. */
export const Route = createFileRoute('/_app/')({
  beforeLoad: ({ context }) => {
    const household = pickHousehold(context.boot)
    if (!household) throw redirect({ to: '/welcome', replace: true })
    throw redirect({
      to: '/h/$householdId',
      params: { householdId: household.id },
      replace: true,
    })
  },
})
