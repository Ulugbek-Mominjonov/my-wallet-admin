import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('app.name')}</CardTitle>
        <CardDescription>{t('auth.loginTitle')}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{t('auth.methodsSoon')}</CardContent>
    </Card>
  )
}
