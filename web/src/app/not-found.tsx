import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-lg p-6">
      <EmptyState
        icon={SearchX}
        title={t('errors.notFoundTitle')}
        description={t('errors.notFoundText')}
        action={<Button render={<Link to="/" />}>{t('common.toHome')}</Button>}
      />
    </div>
  )
}
