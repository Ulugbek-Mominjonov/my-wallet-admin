import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCan } from '@/entities/household'
import { exportHousehold, fetchPlansForExport } from '@/features/tools/api/export-api'
import { planRows } from '@/features/tools/model/export-plans'
import { useAppLocale } from '@/shared/i18n'
import { downloadCsv, downloadFile } from '@/shared/lib/download'
import { formatMonth, shiftMonth, type MonthKey } from '@/shared/lib/month'
import { Button } from '@/shared/ui/button'
import { FormSelect } from '@/shared/ui/form-select'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page-header'
import { SectionCard } from '@/shared/ui/section-card'

/** Davr tanlovidagi oylar. */
const MONTH_OPTIONS = 24
/** Standart davr — so'nggi 12 oy. */
const DEFAULT_MONTHS = 11

/**
 * E25-T02 (BR-180): to'liq JSON zaxira (owner/admin) va rejalar CSV'si.
 * Amallar CSV'si — amallar sahifasida (filtr bilan).
 */
export function ExportPage({
  householdId,
  householdName,
  currentMonth,
}: {
  householdId: string
  householdName: string
  currentMonth: MonthKey
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const canManage = useCan('manage')
  const [from, setFrom] = useState<MonthKey>(shiftMonth(currentMonth, -DEFAULT_MONTHS))
  const [to, setTo] = useState<MonthKey>(currentMonth)
  const months = Array.from({ length: MONTH_OPTIONS }, (_, i) => shiftMonth(currentMonth, -i))
  const monthOptions = months.map((month) => ({ value: month, label: formatMonth(month, locale) }))
  const slug = householdName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const backup = useMutation({
    mutationFn: () => exportHousehold(householdId),
    onSuccess: (data) => {
      downloadFile(
        `${slug || 'byudjet'}-${currentMonth}.json`,
        JSON.stringify(data, null, 2),
        'application/json',
      )
      toast.success(t('export.backupDone'))
    },
  })
  const plans = useMutation({
    mutationFn: () => fetchPlansForExport(householdId, from, to),
    onSuccess: (rows) => {
      downloadCsv(`rejalar-${from}_${to}.csv`, planRows(rows, t))
      toast.success(t('export.plansDone', { count: rows.length }))
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader title={t('export.title')} description={t('export.description')} />

      <SectionCard title={t('export.backup')} description={t('export.backupText')}>
        {canManage ? (
          <Button
            disabled={backup.isPending}
            onClick={() => {
              backup.mutate()
            }}
          >
            <Download aria-hidden />
            {t('export.backupAction')}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('export.onlyAdmin')}</p>
        )}
      </SectionCard>

      <SectionCard title={t('export.plans')} description={t('export.plansText')}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label id="export-from">{t('export.from')}</Label>
            <FormSelect
              labelId="export-from"
              value={from}
              options={monthOptions}
              onChange={(value) => {
                setFrom(value as MonthKey)
                if (value > to) setTo(value as MonthKey)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label id="export-to">{t('export.to')}</Label>
            <FormSelect
              labelId="export-to"
              value={to}
              options={monthOptions}
              onChange={(value) => {
                setTo(value as MonthKey)
                if (value < from) setFrom(value as MonthKey)
              }}
            />
          </div>
          <Button
            variant="outline"
            disabled={plans.isPending}
            onClick={() => {
              plans.mutate()
            }}
          >
            <Download aria-hidden />
            {t('export.plansAction')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t('export.transactions')} description={t('export.transactionsText')}>
        <Button
          variant="outline"
          render={<Link to="/h/$householdId/transactions" params={{ householdId }} />}
        >
          {t('export.transactionsAction')}
        </Button>
      </SectionCard>
    </div>
  )
}
