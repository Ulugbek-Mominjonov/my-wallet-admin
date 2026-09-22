import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { ShieldX, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

/**
 * Marshrut ichidagi xato: huquq yetmasa — 403 (qayta urinish foydasiz),
 * boshqasi — tushunarli matn va qayta urinish.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation()
  const appError = toAppError(error)
  const forbidden = appError.code === 'forbidden'
  return (
    <div className="mx-auto max-w-lg p-6">
      <EmptyState
        icon={forbidden ? ShieldX : TriangleAlert}
        title={forbidden ? t('errors.forbiddenTitle') : t('errors.unexpectedTitle')}
        description={appError.message}
        action={
          forbidden ? (
            <Button render={<Link to="/" />}>{t('common.toHome')}</Button>
          ) : (
            <Button onClick={reset}>{t('common.retry')}</Button>
          )
        }
      />
    </div>
  )
}
