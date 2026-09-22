import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { bootstrapQuery, SessionSettings, TwoFactorSettings } from '@/features/auth'
import { ProfileForm, ThemePicker } from '@/features/profile'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { PageHeader } from '@/shared/ui/page-header'

/** E21-T04: profil — ism, til, mavzu, 2FA, sessiyalar (foydalanuvchi darajasida). */
export const Route = createFileRoute('/_app/h/$householdId/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const { t } = useTranslation()
  const { data: boot } = useSuspenseQuery(bootstrapQuery)
  const { email } = Route.useRouteContext()

  return (
    <>
      <PageHeader title={t('profile.title')} description={email} />
      <Section title={t('profile.detailsTitle')}>
        <ProfileForm profile={boot.profile} />
      </Section>
      <Section title={t('profile.appearanceTitle')} description={t('profile.appearanceHint')}>
        <ThemePicker />
      </Section>
      <Section title={t('mfa.title')} description={t('mfa.description')}>
        <TwoFactorSettings />
      </Section>
      <Section title={t('profile.sessionsTitle')}>
        <SessionSettings />
      </Section>
    </>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
