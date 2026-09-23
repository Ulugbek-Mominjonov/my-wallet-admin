import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { importLegacy, LEGACY_MAX_BYTES, type LegacyResult } from '@/features/tools/api/legacy-api'
import { parseLegacyFile, type LegacySummary } from '@/features/tools/model/legacy'
import { invalidateMoneyWrite } from '@/shared/api/cache'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { PageHeader } from '@/shared/ui/page-header'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

/**
 * E27-T04 (BR-181): eski Sheets eksportini ko'chirish — fayl → tekshiruv
 * (dry-run: hech narsa yozilmaydi) → oylar jadvali (Sheets ↔ yangi tizim).
 * Farq 0 bo'lgandagina "Import" tugmasi ochiladi.
 */
export function LegacyImportPage({
  householdId,
  baseCurrency,
}: {
  householdId: string
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const [payload, setPayload] = useState<unknown>(null)
  const [summary, setSummary] = useState<LegacySummary | null>(null)
  const [result, setResult] = useState<LegacyResult | null>(null)
  const [confirming, setConfirming] = useState(false)

  const run = useMutation({
    mutationFn: ({ dryRun }: { dryRun: boolean }) => importLegacy(householdId, payload, dryRun),
    onSuccess: async (data, { dryRun }) => {
      setResult(data)
      setConfirming(false)
      if (dryRun) return
      toast.success(t('legacy.done', { count: data.counts.incomes + data.counts.expenses }))
      await invalidateMoneyWrite(queryClient, householdId)
    },
  })

  const readFile = async (file: File) => {
    setResult(null)
    if (file.size > LEGACY_MAX_BYTES) {
      setPayload(null)
      setSummary(null)
      toast.error(t('legacy.tooLarge'))
      return
    }
    const parsed = parseLegacyFile(await file.text())
    if ('error' in parsed) {
      setPayload(null)
      setSummary(null)
      toast.error(t(`legacy.errors.${parsed.error}`))
      return
    }
    setPayload(parsed.payload)
    setSummary(parsed.summary)
  }

  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  const matched =
    result !== null &&
    result.months.length > 0 &&
    result.months.every((month) => month.diff.balance === 0 && month.diff.saved === 0)

  return (
    <div className="space-y-6">
      <PageHeader title={t('legacy.title')} description={t('legacy.description')} />

      <SectionCard title={t('legacy.file')} description={t('legacy.fileHint')}>
        <Input
          type="file"
          accept="application/json,.json"
          aria-label={t('legacy.file')}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void readFile(file)
          }}
        />
        {summary && (
          <ul className="mt-4 flex flex-wrap gap-2">
            <li>
              <Badge variant="outline">
                {t('legacy.counts.incomes', { count: summary.incomes })}
              </Badge>
            </li>
            <li>
              <Badge variant="outline">
                {t('legacy.counts.expenses', { count: summary.expenses })}
              </Badge>
            </li>
            <li>
              <Badge variant="outline">
                {t('legacy.counts.fund', { count: summary.personalSpends })}
              </Badge>
            </li>
            <li>
              <Badge variant="outline">
                {t('legacy.counts.months', { count: summary.months })}
              </Badge>
            </li>
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={payload === null || run.isPending}
            onClick={() => {
              run.mutate({ dryRun: true })
            }}
          >
            {t('legacy.check')}
          </Button>
          <Button
            variant="outline"
            disabled={!matched || run.isPending}
            onClick={() => {
              setConfirming(true)
            }}
          >
            <Upload aria-hidden />
            {t('legacy.import')}
          </Button>
        </div>
      </SectionCard>

      {result && (
        <SectionCard title={t('legacy.months')} description={t('legacy.monthsHint')}>
          {matched ? (
            <p className="mb-4 text-sm text-income">{t('legacy.matched')}</p>
          ) : (
            <p className="mb-4 text-sm text-destructive">{t('legacy.notMatched')}</p>
          )}
          <Table aria-label={t('legacy.months')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('legacy.month')}</TableHead>
                <TableHead className="text-right">{t('legacy.legacyBalance')}</TableHead>
                <TableHead className="text-right">{t('legacy.currentBalance')}</TableHead>
                <TableHead className="text-right">{t('legacy.legacySaved')}</TableHead>
                <TableHead className="text-right">{t('legacy.currentSaved')}</TableHead>
                <TableHead className="text-right">{t('legacy.diff')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.months.map((month) => {
                const clean = month.diff.balance === 0 && month.diff.saved === 0
                return (
                  <TableRow key={month.month}>
                    <TableCell>{formatMonth(month.month.slice(0, 7), locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(month.legacy.balance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(month.current.balance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(month.legacy.saved)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(month.current.saved)}
                    </TableCell>
                    <TableCell
                      className={
                        clean
                          ? 'text-right text-muted-foreground tabular-nums'
                          : 'text-right font-medium text-destructive tabular-nums'
                      }
                    >
                      {clean ? '0' : `${money(month.diff.balance)} / ${money(month.diff.saved)}`}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {result.warnings.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {result.warnings.map((warning, index) => (
                <li key={`${warning.code}:${String(index)}`}>
                  {t(`legacy.warnings.${warning.code}`, {
                    defaultValue: warning.code,
                    name: warning.name ?? '',
                  })}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('legacy.confirmTitle')}
        description={t('legacy.confirmText')}
        confirmLabel={t('legacy.import')}
        cancelLabel={t('common.cancel')}
        pending={run.isPending}
        onConfirm={() => {
          run.mutate({ dryRun: false })
        }}
      />
    </div>
  )
}
