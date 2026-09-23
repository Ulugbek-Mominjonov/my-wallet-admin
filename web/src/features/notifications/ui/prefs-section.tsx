import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  prefsKey,
  updatePrefs,
  type NotificationPrefs,
  type PrefsPatch,
} from '@/features/notifications/api/notifications-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'
import { FormSelect } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { SectionCard } from '@/shared/ui/section-card'
import { Switch } from '@/shared/ui/switch'

/** BR-160: eslatma soati (byudjet vaqt zonasida) va necha kun oldinga. */
const HOURS = 24
const DAYS_AHEAD_MAX = 14
/** BR-161: oylik hisobot kuni — har oyda bor kunlar. */
const REPORT_DAY_MAX = 28

type ToggleKey = 'push' | 'telegram' | 'email' | 'monthlyReport' | 'limitAlerts' | 'incomeMissing'
type NumberKey = 'reminderHour' | 'daysAhead' | 'reportDay'

/**
 * E25-T06: kanallar (BR-163), eslatma vaqti (BR-160), oylik hisobot
 * (BR-161) va ogohlantirishlar (BR-133, BR-165) — har o'zgarish darhol
 * saqlanadi (optimistik).
 */
export function PrefsSection({
  householdId,
  prefs,
  telegramLinked,
  baseCurrency,
  multiMember,
}: {
  householdId: string
  prefs: NotificationPrefs
  telegramLinked: boolean
  baseCurrency: string
  /** E30-T03: katta xarajat xabari — faqat oilaviy byudjetda ma'noli. */
  multiMember: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [bigExpenseInvalid, setBigExpenseInvalid] = useState(false)
  const key = prefsKey(householdId)

  const save = useMutation({
    mutationFn: (patch: PrefsPatch) => updatePrefs(householdId, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<NotificationPrefs>(key)
      if (previous) queryClient.setQueryData<NotificationPrefs>(key, { ...previous, ...patch })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: () => {
      toast.success(t('notifications.saved'))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const toggle = (name: ToggleKey, hint?: string, disabled = false) => (
    <div key={name} className="flex items-start justify-between gap-3">
      <div className="grid gap-0.5">
        <Label htmlFor={`pref-${name}`}>{t(`notifications.fields.${name}`)}</Label>
        {hint !== undefined && (
          <p id={`pref-${name}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <Switch
        id={`pref-${name}`}
        checked={prefs[name]}
        disabled={disabled}
        aria-describedby={hint === undefined ? undefined : `pref-${name}-hint`}
        onCheckedChange={(value) => {
          save.mutate({ [name]: value })
        }}
      />
    </div>
  )

  const numberField = (
    name: NumberKey,
    values: readonly number[],
    format: (n: number) => string,
  ) => (
    <div className="grid gap-1.5">
      <Label id={`pref-${name}-label`}>{t(`notifications.fields.${name}`)}</Label>
      <FormSelect
        labelId={`pref-${name}-label`}
        value={String(prefs[name])}
        options={values.map((value) => ({ value: String(value), label: format(value) }))}
        onChange={(value) => {
          save.mutate({ [name]: Number(value) })
        }}
      />
    </div>
  )

  return (
    <>
      <SectionCard
        title={t('notifications.channels')}
        description={t('notifications.channelsHint')}
      >
        <div className="grid max-w-xl gap-4">
          {toggle('push', t('notifications.hints.push'))}
          {toggle(
            'telegram',
            telegramLinked ? undefined : t('notifications.hints.telegram'),
            !telegramLinked,
          )}
          {toggle('email', t('notifications.hints.email'))}
        </div>
      </SectionCard>

      <SectionCard title={t('notifications.schedule')}>
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          {numberField('reminderHour', range(HOURS), (hour) =>
            t('notifications.hour', { hour: String(hour).padStart(2, '0') }),
          )}
          {numberField('daysAhead', range(DAYS_AHEAD_MAX + 1), (days) =>
            t('notifications.days', { count: days }),
          )}
        </div>
      </SectionCard>

      <SectionCard title={t('notifications.monthly')}>
        <div className="grid max-w-xl gap-4">
          {toggle('monthlyReport', t('notifications.hints.monthlyReport'))}
          {prefs.monthlyReport &&
            numberField('reportDay', range(REPORT_DAY_MAX, 1), (day) =>
              t('notifications.day', { day }),
            )}
          {toggle('limitAlerts', t('notifications.hints.limitAlerts'))}
          {toggle('incomeMissing', t('notifications.hints.incomeMissing'))}
          {multiMember && (
            <div className="grid gap-1.5">
              <Label htmlFor="pref-big-expense">{t('notifications.fields.bigExpense')}</Label>
              <Input
                id="pref-big-expense"
                inputMode="decimal"
                className="w-48"
                aria-describedby="pref-big-expense-hint"
                aria-invalid={bigExpenseInvalid ? true : undefined}
                defaultValue={
                  prefs.bigExpense === null ? '' : formatMoneyInput(prefs.bigExpense, baseCurrency)
                }
                onBlur={(event) => {
                  const text = event.target.value.trim()
                  const value = text === '' ? null : parseMoney(text, baseCurrency)
                  if (text !== '' && (value === null || value <= 0)) {
                    setBigExpenseInvalid(true)
                    return
                  }
                  setBigExpenseInvalid(false)
                  if (value !== prefs.bigExpense) save.mutate({ bigExpense: value })
                }}
              />
              <p id="pref-big-expense-hint" className="text-xs text-muted-foreground">
                {t('notifications.hints.bigExpense')}
              </p>
              {bigExpenseInvalid && (
                <p className="text-sm text-destructive">{t('notifications.errors.amount')}</p>
              )}
            </div>
          )}
        </div>
      </SectionCard>
    </>
  )
}

const range = (length: number, from = 0) => Array.from({ length }, (_, index) => index + from)
