import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { categoryTree, type Category } from '@/entities/category'
import { PLAN_KINDS, type RecurringRule } from '@/entities/recurring-rule'
import type { RecurringRuleInput } from '@/features/recurring-rules/api/recurring-rules-api'
import {
  DAY_MAX,
  DAY_MIN,
  NAME_MAX,
  ruleFormDefaults,
  ruleFormSchema,
} from '@/features/recurring-rules/model/rule-form'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { FormSelect } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Switch } from '@/shared/ui/switch'

export interface AccountOption {
  id: string
  name: string
  type: string
}

/**
 * E22-T04: doimiy reja formasi. Kategoriya — tanlangan turdagi (ajratmada
 * yo'q); hisoblar 👤 fondsiz (reja fond hisobiga havola qilmaydi, BR-061).
 */
export function RuleForm({
  rule,
  categories,
  accounts,
  currency,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  rule?: RecurringRule
  categories: readonly Category[]
  accounts: readonly AccountOption[]
  currency: string
  pending: boolean
  error: Error | null
  onSubmit: (input: RecurringRuleInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(ruleFormSchema(currency)),
    defaultValues: ruleFormDefaults(rule, currency),
  })
  const errors = form.formState.errors
  const kind = useWatch({ control: form.control, name: 'kind' })
  const allocation = kind === 'allocation'

  const kindOptions = PLAN_KINDS.map((value) => ({ value, label: t(`rules.kinds.${value}`) }))
  const categoryOptions = categoryTree(
    categories.filter((c) => c.kind === kind && c.archivedAt === null),
  ).map((c) => ({ value: c.id, label: c.parentName ? `${c.parentName} › ${c.name}` : c.name }))
  const accountOptions = [
    ...(allocation ? [] : [{ value: '', label: t('rules.noAccount') }]),
    ...accounts
      .filter((a) => a.type !== 'personal_fund')
      .map((a) => ({ value: a.id, label: a.name })),
  ]

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
    >
      <div className="grid gap-1.5">
        <Label id="rule-kind-label">{t('rules.kind')}</Label>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormSelect
              labelId="rule-kind-label"
              value={field.value}
              options={kindOptions}
              onChange={(value) => {
                field.onChange(value)
                form.setValue('categoryId', '')
              }}
            />
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="rule-name">{t('rules.name')}</Label>
        <Input
          id="rule-name"
          maxLength={NAME_MAX}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'rule-name-error' : undefined}
          {...form.register('name')}
        />
        {errors.name && (
          <p id="rule-name-error" className="text-sm text-destructive">
            {t('directories.errors.name')}
          </p>
        )}
      </div>

      {!allocation && (
        <div className="grid gap-1.5">
          <Label id="rule-category-label">{t('rules.category')}</Label>
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormSelect
                labelId="rule-category-label"
                value={field.value}
                options={categoryOptions}
                onChange={field.onChange}
                invalid={errors.categoryId !== undefined}
                describedBy={errors.categoryId ? 'rule-category-error' : undefined}
              />
            )}
          />
          {errors.categoryId && (
            <p id="rule-category-error" className="text-sm text-destructive">
              {t('rules.errors.category')}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-1.5">
        <Label id="rule-account-label">
          {allocation ? t('rules.sourceAccount') : t('rules.account')}
        </Label>
        <Controller
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormSelect
              labelId="rule-account-label"
              value={field.value}
              options={accountOptions}
              onChange={field.onChange}
              invalid={errors.accountId !== undefined}
              describedBy={errors.accountId ? 'rule-account-error' : undefined}
            />
          )}
        />
        {errors.accountId && (
          <p id="rule-account-error" className="text-sm text-destructive">
            {t('rules.errors.account')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rule-amount">{t('rules.amount')}</Label>
          <Input
            id="rule-amount"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby="rule-amount-hint"
            {...form.register('amount')}
          />
          <p
            id="rule-amount-hint"
            className={errors.amount ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}
          >
            {errors.amount ? t('rules.errors.amount') : t('rules.amountHint')}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rule-day">{t('rules.day')}</Label>
          <Input
            id="rule-day"
            type="number"
            inputMode="numeric"
            min={DAY_MIN}
            max={DAY_MAX}
            aria-invalid={errors.dayOfMonth ? true : undefined}
            aria-describedby="rule-day-hint"
            {...form.register('dayOfMonth')}
          />
          <p
            id="rule-day-hint"
            className={
              errors.dayOfMonth ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'
            }
          >
            {errors.dayOfMonth ? t('rules.errors.day') : t('rules.dayHint')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rule-start">{t('rules.startMonth')}</Label>
          <Input id="rule-start" type="month" {...form.register('startMonth')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rule-end">{t('rules.endMonth')}</Label>
          <Input
            id="rule-end"
            type="month"
            aria-invalid={errors.endMonth ? true : undefined}
            aria-describedby={errors.endMonth ? 'rule-end-error' : undefined}
            {...form.register('endMonth')}
          />
          {errors.endMonth && (
            <p id="rule-end-error" className="text-sm text-destructive">
              {t('rules.errors.endMonth')}
            </p>
          )}
        </div>
      </div>

      <Controller
        control={form.control}
        name="autoPay"
        render={({ field }) => (
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-0.5">
              <Label htmlFor="rule-autopay">{t('rules.autoPay')}</Label>
              <p
                id="rule-autopay-hint"
                className={
                  errors.autoPay ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'
                }
              >
                {errors.autoPay ? t('rules.errors.autoPay') : t('rules.autoPayHint')}
              </p>
            </div>
            <Switch
              id="rule-autopay"
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-describedby="rule-autopay-hint"
            />
          </div>
        )}
      />

      <Controller
        control={form.control}
        name="active"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="rule-active">{t('rules.active')}</Label>
            <Switch id="rule-active" checked={field.value} onCheckedChange={field.onChange} />
          </div>
        )}
      />

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
