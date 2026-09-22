import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { currentSession, safeRedirect } from '@/features/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

/**
 * Google (PKCE) qaytishi: Supabase klienti URL'dagi kodni sessiyaga
 * almashtiradi; tayyor bo'lsa — kutilgan sahifaga, aks holda — xato.
 */
export const Route = createFileRoute('/_auth/auth/callback')({
  validateSearch: z.object({
    redirect: z.string().optional(),
    error_description: z.string().optional(),
  }),
  beforeLoad: async ({ search }) => {
    if (await currentSession())
      throw redirect({ href: safeRedirect(search.redirect), replace: true })
  },
  component: CallbackFailed,
})

function CallbackFailed() {
  const { t } = useTranslation()
  const { error_description: reason } = Route.useSearch()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.callbackFailed')}</CardTitle>
        {reason && <CardDescription>{reason}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Link to="/login" className="text-sm underline underline-offset-4">
          {t('auth.backToLogin')}
        </Link>
      </CardContent>
    </Card>
  )
}
