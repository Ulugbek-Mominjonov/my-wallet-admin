import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { signOut } from '@/features/auth/api/auth-api'
import { TOTP_CODE_LENGTH, totpFactorQuery, verifyTotp } from '@/features/auth/api/mfa-api'
import { CodeForm } from '@/features/auth/ui/code-form'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

/** Kirishdan keyin 2FA kodi (sessiya aal1 → aal2), E21-T04. */
export function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const { t } = useTranslation()
  const factor = useQuery(totpFactorQuery)
  const verify = useMutation({
    mutationFn: async (code: string) => {
      if (!factor.data) throw new Error(t('mfa.noFactor'))
      await verifyTotp(factor.data.id, code)
    },
    onSuccess: onVerified,
    meta: { silent: true },
  })
  const leave = useMutation({ mutationFn: () => signOut() })

  if (factor.isPending) return <Skeleton className="h-24 w-full" />

  return (
    <div className="grid gap-3">
      {factor.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(factor.error).message}
        </p>
      ) : (
        <CodeForm
          id="totp-code"
          label={t('mfa.code')}
          submitLabel={t('mfa.verify')}
          length={TOTP_CODE_LENGTH}
          pending={verify.isPending}
          error={verify.error}
          onSubmit={(code) => {
            verify.mutate(code)
          }}
        />
      )}
      <Button
        variant="link"
        className="justify-self-start px-0"
        disabled={leave.isPending}
        onClick={() => {
          leave.mutate()
        }}
      >
        {t('mfa.otherAccount')}
      </Button>
    </div>
  )
}
