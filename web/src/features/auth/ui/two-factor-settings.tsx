import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  enrollTotp,
  TOTP_CODE_LENGTH,
  totpFactorQuery,
  unenrollFactor,
  verifyTotp,
  type TotpEnrollment,
  type TotpFactor,
} from '@/features/auth/api/mfa-api'
import { CodeForm } from '@/features/auth/ui/code-form'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * E21-T04: 2FA (TOTP) — yoqish (QR + kod bilan tasdiqlash) va o'chirish.
 * Platforma sahifalari aal2 talab qiladi (BR-213).
 */
export function TwoFactorSettings() {
  const { t } = useTranslation()
  const factor = useQuery(totpFactorQuery)
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const enroll = useMutation({ mutationFn: enrollTotp, onSuccess: setEnrollment })

  if (factor.isPending) return <Skeleton className="h-9 w-40" />
  if (factor.isError) {
    return (
      <div className="grid justify-items-start gap-2">
        <p role="alert" className="text-sm text-destructive">
          {toAppError(factor.error).message}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void factor.refetch()
          }}
        >
          {t('common.retry')}
        </Button>
      </div>
    )
  }
  if (factor.data) return <TwoFactorEnabled factor={factor.data} />
  if (enrollment) {
    return (
      <TwoFactorEnroll
        enrollment={enrollment}
        onFinished={() => {
          setEnrollment(null)
        }}
      />
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldOff className="size-4" aria-hidden />
        {t('mfa.disabled')}
      </p>
      <Button
        disabled={enroll.isPending}
        onClick={() => {
          enroll.mutate()
        }}
      >
        {t('mfa.enable')}
      </Button>
    </div>
  )
}

function TwoFactorEnabled({ factor }: { factor: TotpFactor }) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const disable = useMutation({
    mutationFn: () => unenrollFactor(factor.id),
    onSuccess: async () => {
      setConfirming(false)
      toast.success(t('mfa.turnedOff'))
      await queryClient.invalidateQueries({ queryKey: qk.auth() })
    },
  })

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm">
        <ShieldCheck className="size-4 text-primary" aria-hidden />
        {t('mfa.enabledSince', { date: formatDateTime(factor.createdAt, locale) })}
      </p>
      <Button
        variant="outline"
        onClick={() => {
          setConfirming(true)
        }}
      >
        {t('mfa.disable')}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('mfa.disableTitle')}
        description={t('mfa.disableText')}
        confirmLabel={t('mfa.disable')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={disable.isPending}
        onConfirm={() => {
          disable.mutate()
        }}
      />
    </div>
  )
}

function TwoFactorEnroll({
  enrollment,
  onFinished,
}: {
  enrollment: TotpEnrollment
  onFinished: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const verify = useMutation({
    mutationFn: (code: string) => verifyTotp(enrollment.factorId, code),
    onSuccess: async () => {
      toast.success(t('mfa.turnedOn'))
      await queryClient.invalidateQueries({ queryKey: qk.auth() })
      onFinished()
    },
    meta: { silent: true },
  })
  // Bekor qilinsa tugallanmagan omil o'chiriladi (keyingi urinishda ham tozalanadi).
  const cancel = useMutation({
    mutationFn: () => unenrollFactor(enrollment.factorId),
    onSettled: onFinished,
  })

  return (
    <div className="grid gap-4">
      <ol className="grid list-decimal gap-4 pl-5 text-sm">
        <li className="space-y-3">
          <p>{t('mfa.scanStep')}</p>
          <img
            src={enrollment.qrCode}
            alt={t('mfa.qrAlt')}
            className="size-44 rounded-md border bg-white p-2"
          />
          <p className="text-muted-foreground">{t('mfa.secretHint')}</p>
          <code className="block rounded-md bg-muted px-3 py-2 font-mono text-xs break-all select-all">
            {enrollment.secret}
          </code>
        </li>
        <li className="space-y-3">
          <p>{t('mfa.codeStep')}</p>
          <CodeForm
            id="totp-enroll-code"
            label={t('mfa.code')}
            submitLabel={t('mfa.verify')}
            length={TOTP_CODE_LENGTH}
            pending={verify.isPending}
            error={verify.error}
            onSubmit={(code) => {
              verify.mutate(code)
            }}
          />
        </li>
      </ol>
      <Button
        variant="ghost"
        className="justify-self-start"
        disabled={cancel.isPending}
        onClick={() => {
          cancel.mutate()
        }}
      >
        {t('common.cancel')}
      </Button>
    </div>
  )
}
