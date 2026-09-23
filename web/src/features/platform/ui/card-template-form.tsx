import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type {
  CardTemplate,
  CardTemplateInput,
  Currency,
} from '@/features/platform/api/platform-api'
import { cardFormDefaults, cardFormSchema, matchSample } from '@/features/platform/model/forms'
import { Field } from '@/features/platform/ui/form-fields'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { FormSelect } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

/**
 * BR-222: karta xabarnomasi shabloni. Naqsh — nomlangan guruhli regex
 * (`amount` majburiy; `date`, `payee`, `card`); namunaga darhol qo'llanadi,
 * shunda nima ajralishi saqlashdan oldin ko'rinadi.
 */
export function CardTemplateForm({
  template,
  currencies,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  template?: CardTemplate
  currencies: readonly Currency[]
  pending: boolean
  error: Error | null
  onSubmit: (input: CardTemplateInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(cardFormSchema),
    defaultValues: cardFormDefaults(template),
  })
  const errors = form.formState.errors
  const [pattern, sample] = useWatch({ control: form.control, name: ['pattern', 'sample'] })
  const preview = sample.trim() === '' ? null : matchSample(pattern, sample)

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          onSubmit({
            bank: values.bank,
            pattern: values.pattern,
            kind: values.kind,
            amount_unit: values.amount_unit,
            currency: values.currency,
            sample: values.sample.trim() === '' ? null : values.sample.trim(),
            active: values.active,
            sort_order: Number(values.sort_order),
          })
        })(event)
      }}
    >
      <Field
        id="card-bank"
        label={t('platform.fields.bank')}
        error={errors.bank && t('platform.errors.name')}
      >
        <Input
          id="card-bank"
          maxLength={60}
          aria-invalid={errors.bank ? true : undefined}
          {...form.register('bank')}
        />
      </Field>

      <Field
        id="card-pattern"
        label={t('platform.fields.pattern')}
        hint={t('platform.hints.pattern')}
        error={errors.pattern && t('platform.errors.pattern')}
      >
        <Textarea
          id="card-pattern"
          rows={3}
          className="font-mono text-xs"
          aria-invalid={errors.pattern ? true : undefined}
          {...form.register('pattern')}
        />
      </Field>

      <Field id="card-sample" label={t('platform.fields.sample')} hint={t('platform.hints.sample')}>
        <Textarea id="card-sample" rows={2} {...form.register('sample')} />
      </Field>

      {preview !== null && (
        <div className="rounded-lg border p-3 text-sm">
          {preview === 'invalid' ? (
            <p className="text-destructive">{t('platform.errors.pattern')}</p>
          ) : Object.keys(preview).length === 0 ? (
            <p className="text-muted-foreground">{t('platform.preview.noMatch')}</p>
          ) : (
            <dl className="grid gap-1 sm:grid-cols-[8rem_1fr]">
              {Object.entries(preview).map(([group, value]) => (
                <div key={group} className="contents">
                  <dt className="font-mono text-xs text-muted-foreground">{group}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <Field id="card-kind" label={t('platform.fields.kind')} labelledBy>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormSelect
              labelId="card-kind-label"
              value={field.value}
              options={[
                { value: 'expense', label: t('platform.kinds.expense') },
                { value: 'income', label: t('platform.kinds.income') },
              ]}
              onChange={field.onChange}
            />
          )}
        />
      </Field>

      <Field
        id="card-unit"
        label={t('platform.fields.amountUnit')}
        hint={t('platform.hints.amountUnit')}
        labelledBy
      >
        <Controller
          control={form.control}
          name="amount_unit"
          render={({ field }) => (
            <FormSelect
              labelId="card-unit-label"
              value={field.value}
              options={[
                { value: 'major', label: t('platform.units.major') },
                { value: 'minor', label: t('platform.units.minor') },
              ]}
              onChange={field.onChange}
            />
          )}
        />
      </Field>

      <Field id="card-currency" label={t('platform.fields.currency')} labelledBy>
        <Controller
          control={form.control}
          name="currency"
          render={({ field }) => (
            <FormSelect
              labelId="card-currency-label"
              value={field.value}
              options={currencies.map((currency) => ({
                value: currency.code,
                label: currency.code,
              }))}
              onChange={field.onChange}
            />
          )}
        />
      </Field>

      <Field
        id="card-order"
        label={t('platform.fields.order')}
        error={errors.sort_order && t('platform.errors.order')}
      >
        <Input
          id="card-order"
          inputMode="numeric"
          aria-invalid={errors.sort_order ? true : undefined}
          {...form.register('sort_order')}
        />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="card-active">{t('platform.fields.active')}</Label>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Switch id="card-active" checked={field.value} onCheckedChange={field.onChange} />
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
