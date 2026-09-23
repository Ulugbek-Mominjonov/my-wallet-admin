import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { Currency, CurrencyInput } from '@/features/platform/api/platform-api'
import { currencyFormDefaults, currencyFormSchema } from '@/features/platform/model/forms'
import { Field } from '@/features/platform/ui/form-fields'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

/** BR-190: valyuta — kod, uch tilda nom, belgi va kasr xonalari. */
export function CurrencyForm({
  currency,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  currency?: Currency
  pending: boolean
  error: Error | null
  onSubmit: (input: CurrencyInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(currencyFormSchema),
    defaultValues: currencyFormDefaults(currency),
  })
  const errors = form.formState.errors

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          onSubmit({
            code: values.code.toUpperCase(),
            name_i18n: values.name_i18n,
            symbol: values.symbol,
            exponent: Number(values.exponent),
            active: values.active,
            sort_order: Number(values.sort_order),
          })
        })(event)
      }}
    >
      <Field
        id="currency-code"
        label={t('platform.fields.code')}
        hint={t('platform.hints.code')}
        error={errors.code && t('platform.errors.code')}
      >
        <Input
          id="currency-code"
          maxLength={3}
          disabled={currency !== undefined}
          aria-invalid={errors.code ? true : undefined}
          {...form.register('code')}
        />
      </Field>

      {(['uz', 'ru', 'en'] as const).map((locale) => (
        <Field
          key={locale}
          id={`currency-name-${locale}`}
          label={t(`platform.fields.name_${locale}`)}
          error={errors.name_i18n?.[locale] && t('platform.errors.name')}
        >
          <Input
            id={`currency-name-${locale}`}
            maxLength={60}
            aria-invalid={errors.name_i18n?.[locale] ? true : undefined}
            {...form.register(`name_i18n.${locale}`)}
          />
        </Field>
      ))}

      <Field
        id="currency-symbol"
        label={t('platform.fields.symbol')}
        error={errors.symbol && t('platform.errors.symbol')}
      >
        <Input
          id="currency-symbol"
          maxLength={5}
          aria-invalid={errors.symbol ? true : undefined}
          {...form.register('symbol')}
        />
      </Field>

      <Field
        id="currency-exponent"
        label={t('platform.fields.exponent')}
        hint={t('platform.hints.exponent')}
        error={errors.exponent && t('platform.errors.exponent')}
      >
        <Input
          id="currency-exponent"
          inputMode="numeric"
          aria-invalid={errors.exponent ? true : undefined}
          {...form.register('exponent')}
        />
      </Field>

      <Field
        id="currency-order"
        label={t('platform.fields.order')}
        error={errors.sort_order && t('platform.errors.order')}
      >
        <Input
          id="currency-order"
          inputMode="numeric"
          aria-invalid={errors.sort_order ? true : undefined}
          {...form.register('sort_order')}
        />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="currency-active">{t('platform.fields.active')}</Label>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Switch id="currency-active" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
