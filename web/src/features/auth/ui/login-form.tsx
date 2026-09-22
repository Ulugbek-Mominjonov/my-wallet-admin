import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  EMAIL_CODE_LENGTH,
  sendEmailCode,
  signInWithGoogle,
  verifyEmailCode,
} from '@/features/auth/api/auth-api'
import { digitCodeSchema } from '@/features/auth/model/code-schema'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** Kod qayta yuborilishi mumkin bo'lgan oraliq (GoTrue email cheklovi). */
const RESEND_SECONDS = 60

const emailSchema = z.object({ email: z.email() })
const codeSchema = digitCodeSchema(EMAIL_CODE_LENGTH)

/**
 * E21-T01: email kodi (2 qadam) va Google. Muvaffaqiyatda [onSignedIn] —
 * sessiya yangilangach marshrut qayta tekshiriladi. Xatolar forma ichida
 * ko'rsatiladi (`silent` — global toast takrorlamaydi).
 */
export function LoginForm({ redirect, onSignedIn }: { redirect: string; onSignedIn: () => void }) {
  const [email, setEmail] = useState<string | null>(null)
  return email === null ? (
    <EmailStep redirect={redirect} onSent={setEmail} />
  ) : (
    <CodeStep
      email={email}
      onBack={() => {
        setEmail(null)
      }}
      onSignedIn={onSignedIn}
    />
  )
}

function EmailStep({ redirect, onSent }: { redirect: string; onSent: (email: string) => void }) {
  const { t } = useTranslation()
  const form = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } })
  const send = useMutation({
    mutationFn: (email: string) => sendEmailCode(email),
    onSuccess: (_, email) => {
      onSent(email)
    },
    meta: { silent: true },
  })
  const google = useMutation({
    mutationFn: () => signInWithGoogle(redirect),
    meta: { silent: true },
  })
  const error = send.error ?? google.error
  const emailError = form.formState.errors.email

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-3"
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit(({ email }) => {
            send.mutate(email)
          })(event)
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? 'email-error' : undefined}
            {...form.register('email')}
          />
          {emailError && (
            <p id="email-error" className="text-sm text-destructive">
              {t('auth.errors.emailInvalid')}
            </p>
          )}
        </div>
        <Button type="submit" disabled={send.isPending}>
          {t('auth.sendCode')}
        </Button>
      </form>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        variant="outline"
        disabled={google.isPending}
        onClick={() => {
          google.mutate()
        }}
      >
        {t('auth.google')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
    </div>
  )
}

function CodeStep({
  email,
  onBack,
  onSignedIn,
}: {
  email: string
  onBack: () => void
  onSignedIn: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } })
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  useEffect(() => {
    if (cooldown === 0) return
    const timer = setTimeout(() => {
      setCooldown((value) => value - 1)
    }, 1000)
    return () => {
      clearTimeout(timer)
    }
  }, [cooldown])

  const verify = useMutation({
    mutationFn: (code: string) => verifyEmailCode(email, code),
    onSuccess: onSignedIn,
    meta: { silent: true },
  })
  const resend = useMutation({
    mutationFn: () => sendEmailCode(email),
    onSuccess: () => {
      setCooldown(RESEND_SECONDS)
    },
    meta: { silent: true },
  })
  const error = verify.error ?? resend.error
  const codeError = form.formState.errors.code

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(({ code }) => {
          verify.mutate(code)
        })(event)
      }}
    >
      <p className="text-sm text-muted-foreground">{t('auth.codeSent', { email })}</p>
      <div className="grid gap-1.5">
        <Label htmlFor="code">{t('auth.code')}</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={EMAIL_CODE_LENGTH}
          aria-invalid={codeError ? true : undefined}
          aria-describedby={codeError ? 'code-error' : undefined}
          {...form.register('code')}
        />
        {codeError && (
          <p id="code-error" className="text-sm text-destructive">
            {t('auth.errors.codeFormat', { count: EMAIL_CODE_LENGTH })}
          </p>
        )}
      </div>
      <Button type="submit" disabled={verify.isPending}>
        {t('auth.signIn')}
      </Button>
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="link" className="px-0" onClick={onBack}>
          {t('auth.changeEmail')}
        </Button>
        <Button
          type="button"
          variant="link"
          className="px-0"
          disabled={cooldown > 0 || resend.isPending}
          onClick={() => {
            resend.mutate()
          }}
        >
          {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
    </form>
  )
}
