import { createFileRoute, Outlet } from '@tanstack/react-router'

import { AppShell } from '@/features/app-shell'

/** Ichki sahifalar layouti. Kirish talabi (auth guard) E21 da qo'shiladi. */
export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
