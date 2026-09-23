import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  currenciesQuery,
  deleteRate,
  platformKey,
  ratesQuery,
  saveRate,
} from '@/features/platform/api/platform-api'
import { Field } from '@/features/platform/ui/form-fields'
import { parseRate } from '@/shared/lib/money'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormSelect } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** Asosiy valyuta (UZS) uchun kurs saqlanmaydi — 1 ga teng. */
const BASE = 'UZS'

/**
 * E29-T04 (BR-191..193): valyuta kurslari — CBU tarixi va qo'lda tuzatish.
 * Qo'lda kiritilgan kursni kunlik `fx-sync` ustidan yozmaydi.
 */
export function PlatformRatesPage() {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const currencies = useQuery(currenciesQuery)
  const [currency, setCurrency] = useState('USD')
  const [date, setDate] = useState('')
  const [rate, setRate] = useState('')
  const rates = useQuery(ratesQuery(currency))

  const refresh = () => queryClient.invalidateQueries({ queryKey: platformKey('rates') })
  const save = useMutation({
    mutationFn: ({ value }: { value: number }) => saveRate(currency, date, value),
    onSuccess: async () => {
      setDate('')
      setRate('')
      toast.success(t('platform.rates.saved'))
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (day: string) => deleteRate(currency, day),
    onSuccess: async () => {
      toast.success(t('directories.deleted'))
      await refresh()
    },
  })

  const options = (currencies.data ?? [])
    .filter((item) => item.code !== BASE)
    .map((item) => ({ value: item.code, label: `${item.code} — ${item.name_i18n[locale]}` }))
  const parsed = parseRate(rate)
  const ready = parsed !== null && /^\d{4}-\d{2}-\d{2}$/.test(date)

  return (
    <div className="space-y-6">
      <PageHeader title={t('platform.rates.title')} description={t('platform.rates.description')} />

      <SectionCard title={t('platform.rates.add')} description={t('platform.rates.addHint')}>
        <div className="flex flex-wrap items-end gap-3">
          <Field id="rate-currency" label={t('platform.fields.currency')} labelledBy>
            <FormSelect
              labelId="rate-currency-label"
              value={currency}
              options={options.length > 0 ? options : [{ value: currency, label: currency }]}
              onChange={setCurrency}
            />
          </Field>
          <Field id="rate-date" label={t('platform.rates.date')}>
            <Input
              id="rate-date"
              type="date"
              className="w-44"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
              }}
            />
          </Field>
          <Field
            id="rate-value"
            label={t('platform.rates.rate', { currency, base: BASE })}
            error={rate !== '' && parsed === null ? t('transactions.errors.fxRate') : undefined}
          >
            <Input
              id="rate-value"
              inputMode="decimal"
              className="w-44"
              value={rate}
              onChange={(event) => {
                setRate(event.target.value)
              }}
            />
          </Field>
          <Button
            disabled={!ready || save.isPending}
            onClick={() => {
              if (parsed !== null) save.mutate({ value: parsed })
            }}
          >
            <Plus aria-hidden />
            {t('common.save')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t('platform.rates.history', { currency })}>
        {rates.isPending ? (
          <TableSkeleton />
        ) : rates.error ? (
          <QueryError
            error={rates.error}
            onRetry={() => {
              void rates.refetch()
            }}
          />
        ) : rates.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('platform.rates.empty')}</p>
        ) : (
          <Table aria-label={t('platform.rates.history', { currency })}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.rates.date')}</TableHead>
                <TableHead className="text-right">
                  {t('platform.rates.rate', { currency, base: BASE })}
                </TableHead>
                <TableHead>{t('platform.rates.source')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.data.map((row) => (
                <TableRow key={row.rate_date}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(row.rate_date, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.rate_to_base}</TableCell>
                  <TableCell>
                    <Badge variant={row.source === 'manual' ? 'secondary' : 'outline'}>
                      {row.source === 'manual' ? t('platform.rates.manual') : 'CBU'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('platform.rates.delete', { date: row.rate_date })}
                      disabled={remove.isPending}
                      onClick={() => {
                        remove.mutate(row.rate_date)
                      }}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
