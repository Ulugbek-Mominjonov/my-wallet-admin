import { useMutation, useQuery } from '@tanstack/react-query'
import type { ParseKeys } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { sessionInfoQuery, signOut } from '@/features/auth/api/auth-api'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { Skeleton } from '@/shared/ui/skeleton'

/** AMR usuli → matn; noma'lumlari bitta "boshqa usul" bo'lib ko'rinadi. */
const METHOD_KEYS: Record<string, ParseKeys> = {
  otp: 'profile.methods.otp',
  magiclink: 'profile.methods.otp',
  oauth: 'profile.methods.oauth',
  totp: 'profile.methods.totp',
  'mfa/totp': 'profile.methods.totp',
}

/** "Qayerdan kirdim" va barcha qurilmalardan chiqish (E21-T01, E21-T04). */
export function SessionSettings() {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const session = useQuery(sessionInfoQuery)
  const [confirming, setConfirming] = useState(false)
  const everywhere = useMutation({ mutationFn: () => signOut('global') })

  const methods = [
    ...new Set(session.data?.methods.map((m) => t(METHOD_KEYS[m] ?? 'profile.methods.other'))),
  ]

  return (
    <div className="grid gap-4">
      {session.isPending ? (
        <Skeleton className="h-10 w-56" />
      ) : (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">{t('profile.signedInWith')}</dt>
          <dd>{methods.join(' + ') || '—'}</dd>
          <dt className="text-muted-foreground">{t('profile.signedInAt')}</dt>
          <dd>
            {session.data?.signedInAt ? formatDateTime(session.data.signedInAt, locale) : '—'}
          </dd>
        </dl>
      )}
      <Button
        variant="outline"
        className="justify-self-start"
        onClick={() => {
          setConfirming(true)
        }}
      >
        {t('profile.signOutEverywhere')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('profile.signOutEverywhereTitle')}
        description={t('profile.signOutEverywhereText')}
        confirmLabel={t('profile.signOutEverywhere')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={everywhere.isPending}
        onConfirm={() => {
          everywhere.mutate()
        }}
      />
    </div>
  )
}
