import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'

import { EmptyState } from '@/shared/ui/empty-state'
import { PageHeader } from '@/shared/ui/page-header'

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <>
      <PageHeader title="Xulosa" description="Joriy oy bo'yicha asosiy ko'rsatkichlar" />
      <EmptyState
        icon={LayoutDashboard}
        title="Hozircha ma'lumot yo'q"
        description="Ko'rsatkichlar amallar kiritilgandan keyin shu yerda paydo bo'ladi."
      />
    </>
  )
}
