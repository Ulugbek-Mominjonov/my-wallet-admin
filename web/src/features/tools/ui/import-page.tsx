import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ParseKeys } from 'i18next'
import { Upload } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { importTransactions, type ImportResult } from '@/features/tools/api/export-api'
import {
  guessMapping,
  IMPORT_FIELDS,
  toImportRows,
  type ImportField,
  type ImportMapping,
} from '@/features/tools/model/import-csv'
import { invalidateMoneyWrite } from '@/shared/api/cache'
import { parseCsv } from '@/shared/lib/csv'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormSelect } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page-header'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

/** Namunada ko'rsatiladigan qatorlar soni. */
const SAMPLE_ROWS = 5
/** Ustun tanlovidagi "tanlanmagan" qiymati. */
const NONE = 'none'
/** Bu maydonlarsiz import boshlanmaydi. */
const REQUIRED: readonly ImportField[] = ['occurred_on', 'amount', 'category', 'account']

const ERROR_KEYS: Record<string, ParseKeys> = {
  invalid_row: 'import.errorCodes.invalid_row',
  account_not_found: 'import.errorCodes.account_not_found',
  category_not_found: 'import.errorCodes.category_not_found',
  month_closed: 'import.errorCodes.month_closed',
}

/**
 * E25-T03 (BR-182): CSV import — fayl → ustunlarni moslashtirish → tekshirish
 * (yozilmaydi: dublikat va xatolar ko'rsatiladi) → tasdiq → bitta so'rov.
 */
export function ImportPage({
  householdId,
  baseCurrency,
}: {
  householdId: string
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [header, setHeader] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ImportMapping | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const columnOptions = [
    { value: NONE, label: t('import.none') },
    ...header.map((name, index) => ({
      value: String(index),
      label: t('import.column', { index: index + 1, name: name.trim() || '—' }),
    })),
  ]
  const ready =
    mapping !== null && REQUIRED.every((field) => mapping[field] !== null) && rows.length > 0

  const run = useMutation({
    mutationFn: ({ dryRun }: { dryRun: boolean }) =>
      importTransactions(
        householdId,
        mapping === null ? [] : toImportRows(rows, mapping, baseCurrency),
        dryRun,
      ),
    onSuccess: async (data, { dryRun }) => {
      setResult(data)
      if (dryRun) return
      toast.success(t('import.imported', { count: data.imported }))
      await invalidateMoneyWrite(queryClient, householdId)
    },
  })

  const readFile = async (file: File) => {
    const parsed = parseCsv(await file.text())
    const [first = [], ...rest] = parsed
    setHeader(first)
    setRows(rest)
    setMapping(guessMapping(first))
    setResult(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('import.title')} description={t('import.description')} />

      <SectionCard title={t('import.file')} description={t('import.fileHint')}>
        <Input
          type="file"
          accept=".csv,text/csv"
          aria-label={t('import.file')}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void readFile(file)
          }}
        />
      </SectionCard>

      {mapping !== null && (
        <SectionCard title={t('import.mapping')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_FIELDS.map((field) => (
              <div key={field} className="grid gap-1.5">
                <Label id={`map-${field}`}>
                  {t(`import.fields.${field}`)}
                  {REQUIRED.includes(field) && ' *'}
                </Label>
                <FormSelect
                  labelId={`map-${field}`}
                  value={mapping[field] === null ? NONE : String(mapping[field])}
                  options={columnOptions}
                  onChange={(value) => {
                    setMapping({ ...mapping, [field]: value === NONE ? null : Number(value) })
                    setResult(null)
                  }}
                />
              </div>
            ))}
          </div>
          {!ready && <p className="mt-3 text-sm text-muted-foreground">{t('import.required')}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={!ready || run.isPending}
              onClick={() => {
                run.mutate({ dryRun: true })
              }}
            >
              {t('import.previewAction')}
            </Button>
            <Button
              variant="outline"
              disabled={!ready || run.isPending || (result?.ready ?? 0) === 0}
              onClick={() => {
                run.mutate({ dryRun: false })
              }}
            >
              <Upload aria-hidden />
              {t('import.apply')}
            </Button>
          </div>
        </SectionCard>
      )}

      {rows.length > 0 && (
        <SectionCard title={t('import.sample')}>
          <Table aria-label={t('import.sample')}>
            <TableHeader>
              <TableRow>
                {header.map((name, index) => (
                  <TableHead key={`${name}:${String(index)}`}>{name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, SAMPLE_ROWS).map((row, index) => (
                <TableRow key={index}>
                  {header.map((_, cell) => (
                    <TableCell key={cell}>{row[cell] ?? ''}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      {result && (
        <SectionCard title={t('import.preview')}>
          <ul className="flex flex-wrap gap-2">
            <li>
              <Badge variant="outline">{t('import.rows', { count: result.total })}</Badge>
            </li>
            <li>
              <Badge>{t('import.ready', { count: result.ready })}</Badge>
            </li>
            <li>
              <Badge variant="secondary">
                {t('import.duplicates', { count: result.duplicates.length })}
              </Badge>
            </li>
            <li>
              <Badge variant={result.errors.length > 0 ? 'destructive' : 'outline'}>
                {t('import.errors', { count: result.errors.length })}
              </Badge>
            </li>
          </ul>
          {(result.errors.length > 0 || result.duplicates.length > 0) && (
            <Table aria-label={t('import.preview')} className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('import.row')}</TableHead>
                  <TableHead>{t('import.reason')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((error) => (
                  <TableRow key={`e${String(error.index)}`}>
                    <TableCell className="tabular-nums">{error.index}</TableCell>
                    <TableCell>
                      {t(ERROR_KEYS[error.code] ?? 'errors.unknown', { defaultValue: error.code })}
                    </TableCell>
                  </TableRow>
                ))}
                {result.duplicates.map((duplicate) => (
                  <TableRow key={`d${String(duplicate.index)}`}>
                    <TableCell className="tabular-nums">{duplicate.index}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t('import.duplicateOf')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      )}
    </div>
  )
}
