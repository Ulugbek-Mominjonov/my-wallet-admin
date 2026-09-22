import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { CategoryLimit, LimitInput } from '@/features/limits/api/limits-api'
import { limitFormDefaults, limitFormSchema } from '@/features/limits/model/limit-form'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { FormSelect, type SelectOption } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

/** E22-T05: limit formasi — kategoriya yaratishda tanlanadi, keyin o'zgarmaydi. */
export function LimitForm({
  limit,
  categories,
  currency,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  limit?: CategoryLimit
  categories: readonly SelectOption[]
  currency: string
  pending: boolean
  error: Error | null
  onSubmit: (input: LimitInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(limitFormSchema(currency)),
    defaultValues: limitFormDefaults(limit, currency),
  })
  const errors = form.formState.errors

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
    >
      <div className="grid gap-1.5">
        <Label id="limit-category-label">{t('limits.category')}</Label>
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormSelect
              labelId="limit-category-label"
              value={field.value}
              options={categories}
              onChange={field.onChange}
              disabled={limit !== undefined}
              invalid={errors.categoryId !== undefined}
              describedBy="limit-category-hint"
            />
          )}
        />
        <p id="limit-category-hint" className="text-xs text-muted-foreground">
          {categories.length === 0 && !limit ? t('limits.noCategories') : t('limits.categoryHint')}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="limit-amount">{t('limits.amount')}</Label>
        <Input
          id="limit-amount"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={errors.amount ? true : undefined}
          aria-describedby={errors.amount ? 'limit-amount-error' : undefined}
          {...form.register('amount')}
        />
        {errors.amount && (
          <p id="limit-amount-error" className="text-sm text-destructive">
            {t('directories.errors.amountPositive')}
          </p>
        )}
      </div>
      {(['alert80', 'alert100'] as const).map((name) => (
        <Controller
          key={name}
          control={form.control}
          name={name}
          render={({ field }) => (
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`limit-${name}`}>{t(`limits.${name}`)}</Label>
              <Switch id={`limit-${name}`} checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
      <div className="flex justify-end gap-2 pb-4">
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
