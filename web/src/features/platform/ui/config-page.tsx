import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  appConfigQuery,
  deleteConfig,
  platformKey,
  saveConfig,
  type ConfigValue,
} from '@/features/platform/api/platform-api'
import {
  isMaintenanceActive,
  KNOWN_KEYS,
  maintenanceToForm,
  maintenanceToValue,
  versionSchema,
  type MaintenanceForm,
} from '@/features/platform/model/config'
import { Field } from '@/features/platform/ui/form-fields'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Textarea } from '@/shared/ui/textarea'

const EMPTY_MAINTENANCE: MaintenanceForm = {
  enabled: false,
  uz: '',
  ru: '',
  en: '',
  until: '',
}

/**
 * E26-T02: ilova konfiguratsiyasi — majburiy yangilash (BR-214), texnik
 * ishlar banneri va qo'shimcha flaglar. Qiymatlar hamma klientga
 * `app_bootstrap` orqali boradi, shuning uchun shakli serverda ham tekshiriladi.
 */
export function PlatformConfigPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const config = useQuery(appConfigQuery)
  const [version, setVersion] = useState<string | null>(null)
  const [maintenance, setMaintenance] = useState<MaintenanceForm | null>(null)
  const [flag, setFlag] = useState<{ key: string; value: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: ConfigValue }) => saveConfig(key, value),
    onSuccess: async () => {
      toast.success(t('platform.config.saved'))
      await queryClient.invalidateQueries({ queryKey: platformKey('app-config') })
    },
  })
  const remove = useMutation({
    mutationFn: (key: string) => deleteConfig(key),
    onSuccess: async () => {
      setDeleting(null)
      toast.success(t('directories.deleted'))
      await queryClient.invalidateQueries({ queryKey: platformKey('app-config') })
    },
  })

  const header = (
    <PageHeader title={t('platform.config.title')} description={t('platform.config.description')} />
  )

  if (config.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (config.error) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          error={config.error}
          onRetry={() => {
            void config.refetch()
          }}
        />
      </div>
    )
  }

  const byKey = new Map(config.data.map((row) => [row.key, row.value]))
  const rawVersion = byKey.get('min_android_version')
  const storedVersion = typeof rawVersion === 'string' ? rawVersion : ''
  const currentVersion = version ?? storedVersion
  const versionInvalid = !versionSchema.safeParse(currentVersion).success
  const storedMaintenance = maintenanceToForm(byKey.get('maintenance'))
  const form = maintenance ?? storedMaintenance
  const flags = config.data.filter((row) => !KNOWN_KEYS.includes(row.key as 'maintenance'))

  return (
    <div className="space-y-6">
      {header}

      <SectionCard
        title={t('platform.config.version')}
        description={t('platform.config.versionHint')}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field
            id="min-android"
            label={t('platform.config.minAndroid')}
            error={versionInvalid ? t('platform.config.versionError') : undefined}
          >
            <Input
              id="min-android"
              className="w-40"
              value={currentVersion}
              aria-invalid={versionInvalid ? true : undefined}
              onChange={(event) => {
                setVersion(event.target.value)
              }}
            />
          </Field>
          <Button
            aria-label={t('platform.config.saveVersion')}
            disabled={versionInvalid || save.isPending || currentVersion === storedVersion}
            onClick={() => {
              save.mutate({ key: 'min_android_version', value: currentVersion })
            }}
          >
            {t('common.save')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title={t('platform.config.maintenance')}
        description={t('platform.config.maintenanceHint')}
      >
        <div className="grid max-w-xl gap-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="maintenance-on">{t('platform.config.maintenanceOn')}</Label>
            <Switch
              id="maintenance-on"
              checked={form.enabled}
              onCheckedChange={(enabled) => {
                setMaintenance({ ...(enabled ? form : EMPTY_MAINTENANCE), enabled })
              }}
            />
          </div>
          {form.enabled && (
            <>
              {(['uz', 'ru', 'en'] as const).map((locale) => (
                <Field
                  key={locale}
                  id={`maintenance-${locale}`}
                  label={t(`platform.fields.name_${locale}`)}
                >
                  <Textarea
                    id={`maintenance-${locale}`}
                    rows={2}
                    value={form[locale]}
                    onChange={(event) => {
                      setMaintenance({ ...form, [locale]: event.target.value })
                    }}
                  />
                </Field>
              ))}
              <Field
                id="maintenance-until"
                label={t('platform.config.until')}
                hint={t('platform.config.untilHint')}
              >
                <Input
                  id="maintenance-until"
                  type="datetime-local"
                  className="w-56"
                  value={form.until}
                  onChange={(event) => {
                    setMaintenance({ ...form, until: event.target.value })
                  }}
                />
              </Field>
            </>
          )}
          <div className="flex items-center gap-3">
            <Button
              aria-label={t('platform.config.saveMaintenance')}
              disabled={
                save.isPending ||
                (form.enabled && [form.uz, form.ru, form.en].some((m) => m.trim() === ''))
              }
              onClick={() => {
                save.mutate({ key: 'maintenance', value: maintenanceToValue(form) })
              }}
            >
              {t('common.save')}
            </Button>
            {isMaintenanceActive(byKey.get('maintenance'), new Date()) && (
              <Badge variant="destructive">{t('platform.config.active')}</Badge>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t('platform.config.flags')}
        description={t('platform.config.flagsHint')}
        action={
          <Button
            variant="outline"
            onClick={() => {
              setFlag({ key: '', value: 'true' })
            }}
          >
            <Plus aria-hidden />
            {t('platform.directories.add')}
          </Button>
        }
      >
        {flags.length === 0 && flag === null ? (
          <p className="text-sm text-muted-foreground">{t('platform.config.noFlags')}</p>
        ) : (
          <Table aria-label={t('platform.config.flags')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.config.key')}</TableHead>
                <TableHead>{t('platform.config.value')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-mono text-xs">{row.key}</TableCell>
                  <TableCell>
                    <Input
                      aria-label={t('platform.config.valueOf', { key: row.key })}
                      defaultValue={JSON.stringify(row.value)}
                      onBlur={(event) => {
                        const next = parseJson(event.target.value)
                        if (next === undefined) toast.error(t('platform.config.invalidJson'))
                        else if (JSON.stringify(next) !== JSON.stringify(row.value)) {
                          save.mutate({ key: row.key, value: next })
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('platform.config.deleteFlag', { key: row.key })}
                      onClick={() => {
                        setDeleting(row.key)
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {flag !== null && (
                <TableRow>
                  <TableCell>
                    <Input
                      aria-label={t('platform.config.key')}
                      value={flag.key}
                      onChange={(event) => {
                        setFlag({ ...flag, key: event.target.value })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={t('platform.config.value')}
                      value={flag.value}
                      onChange={(event) => {
                        setFlag({ ...flag, value: event.target.value })
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={save.isPending || !/^[a-z][a-z0-9_]{1,63}$/.test(flag.key)}
                      onClick={() => {
                        const value = parseJson(flag.value)
                        if (value === undefined) {
                          toast.error(t('platform.config.invalidJson'))
                          return
                        }
                        save.mutate(
                          { key: flag.key, value },
                          {
                            onSuccess: () => {
                              setFlag(null)
                            },
                          },
                        )
                      }}
                    >
                      {t('common.save')}
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t('platform.config.deleteTitle', { key: deleting ?? '' })}
        description={t('platform.config.deleteText')}
        confirmLabel={t('directories.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting !== null) remove.mutate(deleting)
        }}
      />
    </div>
  )
}

/** JSON qiymat (`true`, `"matn"`, `{...}`); noto'g'ri bo'lsa — `undefined`. */
function parseJson(text: string): ConfigValue | undefined {
  try {
    return JSON.parse(text) as ConfigValue
  } catch {
    return undefined
  }
}
