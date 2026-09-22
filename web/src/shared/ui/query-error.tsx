import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

/** Sahifa ma'lumotini yuklab bo'lmadi — tushunarli matn va qayta urinish. */
export function QueryError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <EmptyState
      icon={TriangleAlert}
      title={t('errors.unexpectedTitle')}
      description={toAppError(error).message}
      action={<Button onClick={onRetry}>{t('common.retry')}</Button>}
    />
  )
}
