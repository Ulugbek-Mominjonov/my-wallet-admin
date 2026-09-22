import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { bootstrapQuery, SessionSettings, TwoFactorSettings } from '@/features/auth'
import { ProfileForm, ThemePicker } from '@/features/profile'
import { PageHeader } from '@/shared/ui/page-header'
import { SectionCard } from '@/shared/ui/section-card'

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
      <SectionCard title={t('profile.detailsTitle')}>
        <ProfileForm profile={boot.profile} />
      </SectionCard>
      <SectionCard title={t('profile.appearanceTitle')} description={t('profile.appearanceHint')}>
        <ThemePicker />
      </SectionCard>
      <SectionCard title={t('mfa.title')} description={t('mfa.description')}>
        <TwoFactorSettings />
      </SectionCard>
      <SectionCard title={t('profile.sessionsTitle')}>
        <SessionSettings />
      </SectionCard>
    </>
  )
}
