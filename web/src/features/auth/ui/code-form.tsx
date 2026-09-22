import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { digitCodeSchema } from '@/features/auth/model/code-schema'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

interface CodeFormProps {
  id: string
  label: string
  submitLabel: string
  length: number
  pending: boolean
  error: Error | null
  onSubmit: (code: string) => void
}

/** Bir martalik raqamli kod (2FA): format tekshiruvi, server xatosi forma ichida. */
export function CodeForm({
  id,
  label,
  submitLabel,
  length,
  pending,
  error,
  onSubmit,
}: CodeFormProps) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(digitCodeSchema(length)),
    defaultValues: { code: '' },
  })
  const codeError = form.formState.errors.code
  const errorId = `${id}-error`

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(({ code }) => {
          onSubmit(code)
        })(event)
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="font-mono tracking-widest"
          maxLength={length}
          aria-invalid={codeError ? true : undefined}
          aria-describedby={codeError ? errorId : undefined}
          {...form.register('code')}
        />
        {codeError && (
          <p id={errorId} className="text-sm text-destructive">
            {t('auth.errors.codeFormat', { count: length })}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
    </form>
  )
}
