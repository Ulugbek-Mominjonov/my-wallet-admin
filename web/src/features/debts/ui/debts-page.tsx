import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HandCoins, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCan } from '@/entities/household'
import {
  createDebt,
  debtsKey,
  debtsQuery,
  deleteDebt,
  setDebtArchived,
  updateDebt,
  type Debt,
  type DebtInput,
  type DebtStatus,
} from '@/features/debts/api/debts-api'
import { DebtForm } from '@/features/debts/ui/debt-form'
import { useOptimisticArchive, useOptimisticRemove } from '@/shared/api/use-directory-mutations'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DataTable } from '@/shared/ui/data-table/data-table'
import { createDataTableColumns } from '@/shared/ui/data-table/features'
import { DirectoryPage } from '@/shared/ui/directory-page'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { EmptyState } from '@/shared/ui/empty-state'
import type { SelectOption } from '@/shared/ui/form-select'
import { MoneyText } from '@/shared/ui/money-text'
import { ProgressBar } from '@/shared/ui/progress-bar'
import { StatCard } from '@/shared/ui/stat-card'
import { Switch } from '@/shared/ui/switch'

const helper = createDataTableColumns<Debt>()

const STATUS_VARIANT: Record<DebtStatus, 'outline' | 'secondary' | 'default'> = {
  unlinked: 'outline',
  pending: 'secondary',
  paying: 'default',
  closed: 'secondary',
}

/**
 * E22-T06: qarzlar (BR-110..118) — qolgan, progress, tugash oyi, 4 holat;
 * jami (BR-114) asosiy valyutadagi qarzlar bo'yicha (valyutalar qo'shilmaydi).
 */
export function DebtsPage({
  householdId,
  currencies,
  baseCurrency,
}: {
  householdId: string
  currencies: readonly SelectOption[]
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const canWrite = useCan('write')
  const queryClient = useQueryClient()
  const [archived, setArchived] = useState(false)
  const list = debtsQuery(householdId, { archived })
  const query = useQuery(list)
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Debt | null>(null)
  const allKey = debtsKey(householdId)

  const save = useMutation({
    mutationFn: (input: DebtInput) =>
      editing === null || editing === 'new'
        ? createDebt(householdId, input)
        : updateDebt(editing.id, input),
    onSuccess: async () => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await queryClient.invalidateQueries({ queryKey: allKey })
    },
    meta: { silent: true },
  })
  const archive = useOptimisticArchive<Debt>({
    listKey: list.queryKey,
    allKey,
    showingArchived: archived,
    archive: setDebtArchived,
  })
  const remove = useOptimisticRemove<Debt>({ listKey: list.queryKey, allKey, remove: deleteDebt })

  const { mutate: archiveDebt } = archive
  const onArchive = useCallback(
    (debt: Debt) => {
      archiveDebt({ id: debt.id, value: debt.archivedAt === null })
    },
    [archiveDebt],
  )
  const columns = useDebtColumns(canWrite, { onEdit: setEditing, onArchive, onDelete: setDeleting })

  const addButton = canWrite && (
    <Button
      onClick={() => {
        save.reset()
        setEditing('new')
      }}
    >
      <Plus aria-hidden />
      {t('debts.add')}
    </Button>
  )

  return (
    <DirectoryPage
      title={t('debts.title')}
      description={t('debts.description')}
      actions={addButton}
      status={{
        isPending: query.isPending,
        error: query.error,
        onRetry: () => {
          void query.refetch()
        },
      }}
      form={{
        open: editing !== null,
        title: editing === 'new' ? t('debts.newTitle') : t('debts.editTitle'),
        onClose: () => {
          setEditing(null)
        },
        content: editing !== null && (
          <DebtForm
            key={editing === 'new' ? 'new' : editing.id}
            debt={editing === 'new' ? undefined : editing}
            currencies={currencies}
            currency={baseCurrency}
            pending={save.isPending}
            error={save.error}
            onSubmit={(input) => {
              save.mutate(input)
            }}
            onCancel={() => {
              setEditing(null)
            }}
          />
        ),
      }}
      remove={{
        name: deleting?.name ?? null,
        pending: remove.isPending,
        onClose: () => {
          setDeleting(null)
        },
        onConfirm: () => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onSettled: () => {
                setDeleting(null)
              },
            })
          }
        },
      }}
    >
      <DebtSummary debts={query.data ?? []} currency={baseCurrency} />
      <DataTable
        data={query.data ?? []}
        columns={columns}
        rowLabel={(debt) => debt.name}
        initialVisibility={{ total: false, monthlyPayment: false }}
        toolbar={
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={archived} onCheckedChange={setArchived} />
            {t('directories.showArchived')}
          </label>
        }
        empty={
          <EmptyState
            icon={HandCoins}
            title={t('debts.emptyTitle')}
            description={t('debts.emptyText')}
            action={addButton}
          />
        }
      />
    </DirectoryPage>
  )
}

/** BR-114: jami — faqat asosiy valyutadagi qarzlar (boshqa valyutalar alohida qator). */
function DebtSummary({ debts, currency }: { debts: readonly Debt[]; currency: string }) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const own = debts.filter((d) => d.currency === currency && d.archivedAt === null)
  const sum = (items: readonly Debt[], pick: (d: Debt) => number) =>
    items.reduce((total, d) => total + pick(d), 0)
  const iOwe = sum(
    own.filter((d) => d.direction === 'i_owe'),
    (d) => d.remaining,
  )
  const owedToMe = sum(
    own.filter((d) => d.direction === 'owed_to_me'),
    (d) => d.remaining,
  )
  const monthly = sum(
    own.filter((d) => d.direction === 'i_owe' && d.remaining > 0),
    (d) => d.monthlyPayment ?? 0,
  )
  const money = (value: number, signed = false) => formatMoney(value, { currency, locale, signed })
  if (own.length === 0) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label={t('debts.summary.iOwe')} value={money(iOwe)} />
      <StatCard label={t('debts.summary.owedToMe')} value={money(owedToMe)} />
      <StatCard label={t('debts.summary.monthly')} value={money(monthly)} />
      <StatCard label={t('debts.summary.net')} value={money(owedToMe - iOwe, true)} />
    </div>
  )
}

function useDebtColumns(
  canWrite: boolean,
  actions: {
    onEdit: (debt: Debt) => void
    onArchive: (debt: Debt) => void
    onDelete: (debt: Debt) => void
  },
) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const { onEdit, onArchive, onDelete } = actions

  return useMemo(() => {
    const columns = helper.columns([
      helper.accessor('name', {
        header: t('debts.name'),
        enableHiding: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            {canWrite ? (
              <button
                type="button"
                className="rounded-md text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => {
                  onEdit(row.original)
                }}
              >
                {row.original.name}
              </button>
            ) : (
              <span className="font-medium">{row.original.name}</span>
            )}
            {row.original.archivedAt && (
              <Badge variant="outline">{t('directories.archived')}</Badge>
            )}
          </span>
        ),
      }),
      helper.accessor((d) => t(`debts.directions.${d.direction}`), {
        id: 'direction',
        header: t('debts.direction'),
        meta: { label: t('debts.direction') },
      }),
      helper.accessor('total', {
        header: t('debts.total'),
        meta: { label: t('debts.total'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <MoneyText amount={row.original.total} currency={row.original.currency} />
        ),
      }),
      helper.accessor('remaining', {
        header: t('debts.remaining'),
        meta: { label: t('debts.remaining'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="grid justify-items-end">
            <MoneyText amount={row.original.remaining} currency={row.original.currency} />
            {row.original.pendingAmount > 0 && (
              <span className="text-xs text-muted-foreground">
                {t('debts.pending', {
                  amount: formatMoney(row.original.pendingAmount, {
                    currency: row.original.currency,
                    locale,
                  }),
                })}
              </span>
            )}
          </span>
        ),
      }),
      helper.accessor('progress', {
        header: t('debts.progress'),
        meta: { label: t('debts.progress') },
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const percent = Math.round(row.original.progress * 100)
          return (
            <span className="flex min-w-32 items-center gap-2">
              <ProgressBar
                className="flex-1"
                value={row.original.progress}
                tone={row.original.status === 'closed' ? 'income' : 'primary'}
                label={`${String(percent)}%`}
              />
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {percent}%
              </span>
            </span>
          )
        },
      }),
      helper.accessor('monthlyPayment', {
        header: t('debts.monthlyPayment'),
        meta: { label: t('debts.monthlyPayment'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) =>
          row.original.monthlyPayment === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <MoneyText amount={row.original.monthlyPayment} currency={row.original.currency} />
          ),
      }),
      helper.accessor(
        (d) =>
          d.monthsLeft !== null && d.endMonth
            ? t('debts.finishValue', {
                months: d.monthsLeft,
                month: formatMonth(d.endMonth.slice(0, 7), locale),
              })
            : d.status === 'closed'
              ? '—'
              : t('debts.noSchedule'),
        { id: 'finish', header: t('debts.finish'), meta: { label: t('debts.finish') } },
      ),
      helper.accessor('status', {
        header: t('debts.statusLabel'),
        meta: { label: t('debts.statusLabel') },
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANT[row.original.status]}>
            {t(`debts.status.${row.original.status}`)}
          </Badge>
        ),
      }),
    ])
    if (!canWrite) return columns
    return [
      ...columns,
      helper.display({
        id: 'actions',
        header: () => <span className="sr-only">{t('directories.actions')}</span>,
        enableHiding: false,
        cell: ({ row }) => (
          <DirectoryRowActions
            name={row.original.name}
            archived={row.original.archivedAt !== null}
            onEdit={() => {
              onEdit(row.original)
            }}
            onArchive={() => {
              onArchive(row.original)
            }}
            onDelete={() => {
              onDelete(row.original)
            }}
          />
        ),
      }),
    ]
  }, [t, locale, canWrite, onEdit, onArchive, onDelete])
}
