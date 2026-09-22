import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  settingsKey,
  updateSettings,
  type HouseholdSettings,
} from '@/features/household-settings/api/settings-api'
import { Label } from '@/shared/ui/label'
import { SectionCard } from '@/shared/ui/section-card'
import { Switch } from '@/shared/ui/switch'

type PolicyKey = 'autoOpenMonth' | 'strictMonthLock'

/** E22-T07: oy siyosati (BR-084 avto-ochish, BR-055 qattiq qulf) — darhol saqlanadi. */
export function MonthPolicySection({
  settings,
  canManage,
}: {
  settings: HouseholdSettings
  canManage: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const key = settingsKey(settings.id)
  const toggle = useMutation({
    mutationFn: ({ name, value }: { name: PolicyKey; value: boolean }) =>
      updateSettings(settings.id, { [name]: value }),
    onMutate: async ({ name, value }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<HouseholdSettings>(key)
      if (previous) queryClient.setQueryData<HouseholdSettings>(key, { ...previous, [name]: value })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: () => {
      toast.success(t('settings.saved'))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
  const rows: { name: PolicyKey; label: string; hint: string }[] = [
    {
      name: 'autoOpenMonth',
      label: t('settings.month.autoOpen'),
      hint: t('settings.month.autoOpenHint'),
    },
    {
      name: 'strictMonthLock',
      label: t('settings.month.strictLock'),
      hint: t('settings.month.strictLockHint'),
    },
  ]

  return (
    <SectionCard title={t('settings.month.title')}>
      <div className="grid max-w-xl gap-4">
        {rows.map((row) => (
          <div key={row.name} className="flex items-start justify-between gap-3">
            <div className="grid gap-0.5">
              <Label htmlFor={`policy-${row.name}`}>{row.label}</Label>
              <p id={`policy-${row.name}-hint`} className="text-xs text-muted-foreground">
                {row.hint}
              </p>
            </div>
            <Switch
              id={`policy-${row.name}`}
              checked={settings[row.name]}
              disabled={!canManage}
              aria-describedby={`policy-${row.name}-hint`}
              onCheckedChange={(value) => {
                toggle.mutate({ name: row.name, value })
              }}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
