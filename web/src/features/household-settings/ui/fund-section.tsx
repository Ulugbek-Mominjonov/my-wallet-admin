import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { fundAllocation } from '@/entities/household'
import {
  updateSettings,
  type HouseholdSettings,
  type SettingsPatch,
} from '@/features/household-settings/api/settings-api'
import {
  fundFormDefaults,
  fundFormSchema,
} from '@/features/household-settings/model/settings-forms'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney, parseMoney } from '@/shared/lib/money'
import { AmountField } from '@/shared/ui/amount-field'
import { Button } from '@/shared/ui/button'
import { FormSelect, type SelectOption } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { SectionCard } from '@/shared/ui/section-card'

/**
 * E22-T07: 👤 fond qoidasi (BR-060) — rejim, foiz yoki summa, kun, manba;
 * "joriy oy ajratmasi" formadagi qiymatlardan jonli (server formulasi bilan).
 */
export function FundSection({
  settings,
  accounts,
  income,
  unit,
  canManage,
}: {
  settings: HouseholdSettings
  accounts: readonly SelectOption[]
  /** Joriy oy daromadi (yuklanmagan bo'lsa — `undefined`). */
  income: number | undefined
  /** Ajratma yaxlitlash birligi (`currencies.allocation_rounding`). */
  unit: number
  canManage: boolean
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const currency = settings.baseCurrency
  const form = useForm({
    resolver: zodResolver(fundFormSchema(currency)),
    defaultValues: fundFormDefaults(settings),
  })
  const errors = form.formState.errors
  const [mode, percentText, fixedText] = useWatch({
    control: form.control,
    name: ['fundMode', 'fundPercent', 'fundFixedAmount'],
  })
  const save = useMutation({
    mutationFn: (patch: SettingsPatch) => updateSettings(settings.id, patch),
    onSuccess: async () => {
      form.reset(form.getValues())
      toast.success(t('settings.saved'))
      // Fond rejasi summasi serverda qayta hisoblanadi (BR-083) — hisobotlar ham.
      await queryClient.invalidateQueries({ queryKey: qk.household(settings.id) })
    },
    meta: { silent: true },
  })

  const money = (value: number) => formatMoney(value, { currency, locale })
  const percent = Number(percentText.replace(',', '.'))
  const preview = (() => {
    if (mode === 'fixed') {
      const amount = parseMoney(fixedText || '0', currency) ?? 0
      return amount > 0
        ? t('settings.fund.previewFixed', { amount: money(amount) })
        : t('settings.fund.previewNone')
    }
    if (income === undefined || Number.isNaN(percent)) return null
    const amount = fundAllocation(income, percent, unit)
    return amount === null
      ? t('settings.fund.previewNone')
      : t('settings.fund.previewPercent', { amount: money(amount), income: money(income), percent })
  })()
  const modeOptions = (['percent', 'fixed'] as const).map((value) => ({
    value,
    label: t(`settings.fund.modes.${value}`),
  }))
  const sourceOptions = [{ value: '', label: t('settings.fund.noSource') }, ...accounts]

  return (
    <SectionCard title={t('settings.fund.title')} description={t('settings.fund.description')}>
      <form
        className="grid max-w-xl gap-4"
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit((patch) => {
            save.mutate(patch)
          })(event)
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label id="fund-mode-label">{t('settings.fund.mode')}</Label>
            <Controller
              control={form.control}
              name="fundMode"
              render={({ field }) => (
                <FormSelect
                  labelId="fund-mode-label"
                  value={field.value}
                  options={modeOptions}
                  onChange={field.onChange}
                  disabled={!canManage}
                />
              )}
            />
          </div>
          {mode === 'percent' ? (
            <div className="grid gap-1.5">
              <Label htmlFor="fund-percent">{t('settings.fund.percent')}</Label>
              <Input
                id="fund-percent"
                inputMode="decimal"
                aria-invalid={errors.fundPercent ? true : undefined}
                aria-describedby={errors.fundPercent ? 'fund-percent-error' : undefined}
                {...form.register('fundPercent')}
                disabled={!canManage}
              />
              {errors.fundPercent && (
                <p id="fund-percent-error" className="text-sm text-destructive">
                  {t('settings.fund.errors.percent')}
                </p>
              )}
            </div>
          ) : (
            <AmountField
              id="fund-fixed"
              label={t('settings.fund.fixedAmount')}
              error={errors.fundFixedAmount ? t('settings.fund.errors.amount') : undefined}
              registration={form.register('fundFixedAmount')}
              disabled={!canManage}
            />
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="fund-day">{t('settings.fund.day')}</Label>
            <Input
              id="fund-day"
              type="number"
              min={1}
              max={31}
              aria-invalid={errors.fundDay ? true : undefined}
              aria-describedby={errors.fundDay ? 'fund-day-error' : undefined}
              {...form.register('fundDay')}
              disabled={!canManage}
            />
            {errors.fundDay && (
              <p id="fund-day-error" className="text-sm text-destructive">
                {t('settings.fund.errors.day')}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label id="fund-source-label">{t('settings.fund.source')}</Label>
            <Controller
              control={form.control}
              name="fundSourceAccountId"
              render={({ field }) => (
                <FormSelect
                  labelId="fund-source-label"
                  value={field.value}
                  options={sourceOptions}
                  onChange={field.onChange}
                  disabled={!canManage}
                />
              )}
            />
          </div>
        </div>
        {preview && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm" aria-live="polite">
            {preview}
          </p>
        )}
        {save.error && (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(save.error).message}
          </p>
        )}
        {canManage && (
          <Button
            type="submit"
            className="justify-self-start"
            disabled={save.isPending || !form.formState.isDirty}
          >
            {t('settings.save')}
          </Button>
        )}
      </form>
    </SectionCard>
  )
}
