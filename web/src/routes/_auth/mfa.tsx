import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  assuranceLevel,
  currentSession,
  MfaChallenge,
  mfaGate,
  safeRedirect,
} from '@/features/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

/** E21-T04: kirgandan keyin 2FA kodi; kerak bo'lmasa — kutilgan sahifaga. */
export const Route = createFileRoute('/_auth/mfa')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ search, location }) => {
    if (!(await currentSession())) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (mfaGate(await assuranceLevel(), { required: false }) === 'ok') {
      throw redirect({ href: safeRedirect(search.redirect), replace: true })
    }
  },
  component: MfaPage,
})

function MfaPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const target = safeRedirect(Route.useSearch().redirect)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('mfa.challengeTitle')}</CardTitle>
        <CardDescription>{t('mfa.challengeText')}</CardDescription>
      </CardHeader>
      <CardContent>
        <MfaChallenge
          onVerified={() => {
            void router.navigate({ href: target, replace: true })
          }}
        />
      </CardContent>
    </Card>
  )
}
