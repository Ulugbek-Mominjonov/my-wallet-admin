import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  outboxKey,
  sendMonthlyReportNow,
  testNotification,
  archiveKey,
  type ChannelResult,
} from '@/features/notifications/api/notifications-api'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth, shiftMonth, type MonthKey } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormSelect } from '@/shared/ui/form-select'
import { Label } from '@/shared/ui/label'
import { SectionCard } from '@/shared/ui/section-card'

/** Oy tanlovidagi oylar (o'tgan oydan boshlab). */
const MONTHS = 12

/**
 * E25-T06 (BR-164): sinov xabari va "oylik hisobotni hozir yuborish" —
 * natija har kanal uchun aniq: yuborildi yoki nega yuborilmadi.
 */
export function TestSection({
  householdId,
  currentMonth,
  baseCurrency,
}: {
  householdId: string
  currentMonth: MonthKey
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState<MonthKey>(shiftMonth(currentMonth, -1))
  const [result, setResult] = useState<{ channels: ChannelResult[]; summary?: string } | null>(null)

  const refreshLogs = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: outboxKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: archiveKey(householdId) }),
    ])

  const test = useMutation({
    mutationFn: () => testNotification(householdId),
    onSuccess: async (channels) => {
      setResult({ channels })
      await refreshLogs()
    },
  })

  const report = useMutation({
    mutationFn: () => sendMonthlyReportNow(householdId, month),
    onSuccess: async (data) => {
      const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
      setResult({
        channels: data.channels,
        summary: t('notifications.test.summary', {
          month: formatMonth(month, locale),
          income: money(data.report.income),
          expense: money(data.report.expense),
          saved: money(data.report.saved),
        }),
      })
      await refreshLogs()
    },
  })

  const months = Array.from({ length: MONTHS }, (_, index) => shiftMonth(currentMonth, -index - 1))
  const pending = test.isPending || report.isPending

  return (
    <SectionCard title={t('notifications.test.title')} description={t('notifications.test.hint')}>
      <div className="flex flex-wrap items-end gap-3">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            test.mutate()
          }}
        >
          <Send aria-hidden />
          {t('notifications.test.send')}
        </Button>
        <div className="grid gap-1.5">
          <Label id="report-month-label">{t('notifications.test.month')}</Label>
          <FormSelect
            labelId="report-month-label"
            value={month}
            options={months.map((value) => ({ value, label: formatMonth(value, locale) }))}
            onChange={(value) => {
              setMonth(value as MonthKey)
            }}
          />
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            report.mutate()
          }}
        >
          {t('notifications.test.sendReport')}
        </Button>
      </div>

      {result && (
        <div className="mt-4 space-y-2">
          {result.summary !== undefined && <p className="text-sm">{result.summary}</p>}
          <ul className="flex flex-wrap gap-2">
            {result.channels.map((channel) => (
              <li key={channel.channel}>
                <Badge variant={channel.queued ? 'default' : 'outline'}>
                  {t(`notifications.channel.${channel.channel}`)}:{' '}
                  {channel.queued
                    ? t('notifications.test.queued')
                    : t(`notifications.reasons.${channel.reason ?? 'unknown'}`, {
                        defaultValue: channel.reason ?? '',
                      })}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  )
}
