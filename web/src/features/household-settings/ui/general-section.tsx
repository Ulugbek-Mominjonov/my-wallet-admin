import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  settingsKey,
  updateSettings,
  type HouseholdSettings,
} from '@/features/household-settings/api/settings-api'
import {
  generalFormDefaults,
  generalFormSchema,
  HOUSEHOLD_NAME_MAX,
} from '@/features/household-settings/model/settings-forms'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { Button } from '@/shared/ui/button'
import { FormSelect } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { SectionCard } from '@/shared/ui/section-card'

/** IANA vaqt zonalari (brauzer ro'yxati); joriy qiymat ro'yxatda bo'lmasa ham ko'rinadi. */
function useTimezones(current: string) {
  return useMemo(() => {
    const zones = Intl.supportedValuesOf('timeZone')
    const all = zones.includes(current) ? zones : [current, ...zones]
    return all.map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') }))
  }, [current])
}

/** E22-T07: nom va vaqt zonasi; asosiy valyuta — faqat ko'rinadi. */
export function GeneralSection({
  settings,
  canManage,
}: {
  settings: HouseholdSettings
  canManage: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const timezones = useTimezones(settings.timezone)
  const form = useForm({
    resolver: zodResolver(generalFormSchema),
    defaultValues: generalFormDefaults(settings),
  })
  const save = useMutation({
    mutationFn: (patch: { name: string; timezone: string }) => updateSettings(settings.id, patch),
    onSuccess: async (_, patch) => {
      form.reset(patch)
      toast.success(t('settings.saved'))
      // Nom va zona almashtirgich va marshrut kontekstida ham (bootstrap).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsKey(settings.id) }),
        queryClient.invalidateQueries({ queryKey: qk.bootstrap() }),
      ])
    },
    meta: { silent: true },
  })
  const nameError = form.formState.errors.name

  return (
    <SectionCard title={t('settings.general.title')}>
      <form
        className="grid max-w-xl gap-4"
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            save.mutate(values)
          })(event)
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="settings-name">{t('settings.general.name')}</Label>
          <Input
            id="settings-name"
            maxLength={HOUSEHOLD_NAME_MAX}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'settings-name-error' : undefined}
            {...form.register('name')}
            disabled={!canManage}
          />
          {nameError && (
            <p id="settings-name-error" className="text-sm text-destructive">
              {t('settings.general.nameError')}
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="settings-currency">{t('settings.general.baseCurrency')}</Label>
            <Input
              id="settings-currency"
              value={settings.baseCurrency}
              readOnly
              aria-describedby="settings-currency-hint"
            />
            <p id="settings-currency-hint" className="text-xs text-muted-foreground">
              {t('settings.general.baseCurrencyHint')}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label id="settings-timezone-label">{t('settings.general.timezone')}</Label>
            <Controller
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormSelect
                  labelId="settings-timezone-label"
                  value={field.value}
                  options={timezones}
                  onChange={field.onChange}
                  disabled={!canManage}
                  describedBy="settings-timezone-hint"
                />
              )}
            />
            <p id="settings-timezone-hint" className="text-xs text-muted-foreground">
              {t('settings.general.timezoneHint')}
            </p>
          </div>
        </div>
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
