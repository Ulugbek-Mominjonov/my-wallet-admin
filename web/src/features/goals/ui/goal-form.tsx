import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { Goal, GoalInput } from '@/features/goals/api/goals-api'
import { goalFormDefaults, goalFormSchema, NAME_MAX } from '@/features/goals/model/goal-form'
import { toAppError } from '@/shared/api/errors'
import { AmountField } from '@/shared/ui/amount-field'
import { Button } from '@/shared/ui/button'
import { FormSelect, type SelectOption } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

export interface GoalAccountOption {
  id: string
  name: string
  currency: string
}

/**
 * E22-T06: maqsad formasi (BR-120..122). Bog'lash — faqat maqsad valyutasidagi
 * hisoblar (`currency_mismatch`); bog'langanda yig'ilgan qo'lda kiritilmaydi.
 */
export function GoalForm({
  goal,
  currencies,
  accounts,
  currency,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  goal?: Goal
  currencies: readonly SelectOption[]
  accounts: readonly GoalAccountOption[]
  currency: string
  pending: boolean
  error: Error | null
  onSubmit: (input: GoalInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goalFormDefaults(goal, currency),
  })
  const errors = form.formState.errors
  const selectedCurrency = useWatch({ control: form.control, name: 'currency' })
  const linked = useWatch({ control: form.control, name: 'accountId' }) !== ''
  const accountOptions = [
    { value: '', label: t('goals.noAccount') },
    ...accounts
      .filter((a) => a.currency === selectedCurrency)
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
        <Label htmlFor="goal-name">{t('goals.name')}</Label>
        <Input
          id="goal-name"
          maxLength={NAME_MAX}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'goal-name-error' : undefined}
          {...form.register('name')}
        />
        {errors.name && (
          <p id="goal-name-error" className="text-sm text-destructive">
            {t('directories.errors.name')}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <AmountField
          id="goal-target"
          label={t('goals.target')}
          error={errors.target ? t('goals.errors.target') : undefined}
          registration={form.register('target')}
        />
        <div className="grid gap-1.5">
          <Label id="goal-currency-label">{t('goals.currency')}</Label>
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormSelect
                labelId="goal-currency-label"
                value={field.value}
                options={currencies}
                onChange={(value) => {
                  field.onChange(value)
                  form.setValue('accountId', '')
                }}
                disabled={goal !== undefined}
              />
            )}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label id="goal-account-label">{t('goals.account')}</Label>
        <Controller
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormSelect
              labelId="goal-account-label"
              value={field.value}
              options={accountOptions}
              onChange={field.onChange}
              describedBy="goal-account-hint"
            />
          )}
        />
        <p id="goal-account-hint" className="text-xs text-muted-foreground">
          {t('goals.accountHint')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!linked && (
          <AmountField
            id="goal-saved"
            label={t('goals.savedManual')}
            error={errors.savedManual ? t('goals.errors.amount') : undefined}
            registration={form.register('savedManual')}
          />
        )}
        <AmountField
          id="goal-monthly"
          label={t('goals.monthly')}
          error={errors.monthlyContribution ? t('goals.errors.amount') : undefined}
          registration={form.register('monthlyContribution')}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="goal-deadline">{t('goals.deadline')}</Label>
        <Input id="goal-deadline" type="month" {...form.register('deadline')} />
      </div>
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
