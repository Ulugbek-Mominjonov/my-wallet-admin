import type { ErrorComponentProps } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

/** Marshrut ichidagi kutilmagan xato: foydalanuvchiga tushunarli matn, qayta urinish. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation()
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="mx-auto max-w-lg p-6">
      <EmptyState
        icon={TriangleAlert}
        title={t('errors.unexpectedTitle')}
        description={message}
        action={<Button onClick={reset}>{t('common.retry')}</Button>}
      />
    </div>
  )
}
