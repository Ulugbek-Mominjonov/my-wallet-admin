import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Ichki sahifalar layouti. Sidebar va topbar E02-T06 da, kirish talabi E21 da. */
export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <Outlet />
    </main>
  )
}
