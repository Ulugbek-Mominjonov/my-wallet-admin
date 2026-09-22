import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { currentSession, LoginForm, safeRedirect } from '@/features/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

export const Route = createFileRoute('/_auth/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  // Allaqachon kirgan — kirish sahifasi kerak emas.
  beforeLoad: async ({ search }) => {
    if (await currentSession()) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const search = Route.useSearch()
  const target = safeRedirect(search.redirect)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('app.name')}</CardTitle>
        <CardDescription>{t('auth.loginTitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm
          redirect={target}
          onSignedIn={() => {
            void router.navigate({ href: target, replace: true })
          }}
        />
      </CardContent>
    </Card>
  )
}
