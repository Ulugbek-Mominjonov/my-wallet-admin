import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Kirish sahifalari uchun layout: markazda bitta karta. */
export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </main>
  )
}
