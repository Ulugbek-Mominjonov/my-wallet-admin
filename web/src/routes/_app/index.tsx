import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/shared/ui/empty-state'
import { PageHeader } from '@/shared/ui/page-header'

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
})

function DashboardPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />
      <EmptyState
        icon={LayoutDashboard}
        title={t('dashboard.emptyTitle')}
        description={t('dashboard.emptyText')}
      />
    </>
  )
}
