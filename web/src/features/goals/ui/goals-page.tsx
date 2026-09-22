import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCan } from '@/entities/household'
import {
  createGoal,
  deleteGoal,
  goalsKey,
  goalsQuery,
  reorderGoals,
  updateGoal,
  type Goal,
  type GoalInput,
} from '@/features/goals/api/goals-api'
import { GoalForm, type GoalAccountOption } from '@/features/goals/ui/goal-form'
import { useOptimisticRemove, useOptimisticReorder } from '@/shared/api/use-directory-mutations'
import { useAppLocale } from '@/shared/i18n'
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

const helper = createDataTableColumns<Goal>()

/**
 * E22-T06: maqsadlar (BR-120..123) — yig'ilgan (qo'lda yoki hisob qoldig'i),
 * progress, prognoz ("N oy (oy)"), muddatga ulgurish; tartib — member ham.
 */
export function GoalsPage({
  householdId,
  currencies,
  accounts,
  baseCurrency,
}: {
  householdId: string
  currencies: readonly SelectOption[]
  accounts: readonly GoalAccountOption[]
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const canWrite = useCan('write')
  const queryClient = useQueryClient()
  const list = goalsQuery(householdId)
  const query = useQuery(list)
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Goal | null>(null)
  const allKey = goalsKey(householdId)

  const save = useMutation({
    mutationFn: async (input: GoalInput) => {
      if (editing === null || editing === 'new') {
        const last = Math.max(-1, ...(query.data ?? []).map((g) => g.sortOrder))
        await createGoal(householdId, input, last + 1)
      } else {
        await updateGoal(editing.id, input)
      }
    },
    onSuccess: async () => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await queryClient.invalidateQueries({ queryKey: allKey })
    },
    meta: { silent: true },
  })
  const remove = useOptimisticRemove<Goal>({ listKey: list.queryKey, allKey, remove: deleteGoal })
  const reorder = useOptimisticReorder<Goal>({
    listKey: list.queryKey,
    allKey,
    reorder: (ids) => reorderGoals(householdId, ids),
  })

  const columns = useMemo(() => {
    const accountName = new Map(accounts.map((a) => [a.id, a.name]))
    const base = helper.columns([
      helper.accessor('name', {
        header: t('goals.name'),
        enableHiding: false,
        cell: ({ row }) =>
          canWrite ? (
            <button
              type="button"
              className="rounded-md text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => {
                setEditing(row.original)
              }}
            >
              {row.original.name}
            </button>
          ) : (
            <span className="font-medium">{row.original.name}</span>
          ),
      }),
      helper.accessor('target', {
        header: t('goals.target'),
        meta: { label: t('goals.target'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <MoneyText amount={row.original.target} currency={row.original.currency} />
        ),
      }),
      helper.accessor('saved', {
        header: t('goals.saved'),
        meta: { label: t('goals.saved'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <MoneyText amount={row.original.saved} currency={row.original.currency} />
        ),
      }),
      helper.accessor('progress', {
        header: t('goals.progress'),
        meta: { label: t('goals.progress') },
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const percent = Math.round(row.original.progress * 100)
          return (
            <span className="flex min-w-32 items-center gap-2">
              <ProgressBar
                className="flex-1"
                value={row.original.progress}
                tone={row.original.remaining === 0 ? 'income' : 'primary'}
                label={`${String(percent)}%`}
              />
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {percent}%
              </span>
            </span>
          )
        },
      }),
      helper.accessor(
        (g) =>
          g.remaining === 0
            ? t('goals.done')
            : g.monthsLeft !== null && g.endMonth
              ? t('goals.forecastValue', {
                  months: g.monthsLeft,
                  month: formatMonth(g.endMonth.slice(0, 7), locale),
                })
              : t('goals.noMonthly'),
        {
          id: 'forecast',
          header: t('goals.forecast'),
          meta: { label: t('goals.forecast') },
          cell: ({ row, getValue }) => (
            <span className="flex flex-wrap items-center gap-2">
              {getValue()}
              {row.original.deadline && row.original.onTrack !== null && (
                <Badge variant={row.original.onTrack ? 'secondary' : 'destructive'}>
                  {row.original.onTrack ? t('goals.onTrack') : t('goals.offTrack')}
                </Badge>
              )}
            </span>
          ),
        },
      ),
      helper.accessor((g) => (g.deadline ? formatMonth(g.deadline.slice(0, 7), locale) : ''), {
        id: 'deadline',
        header: t('goals.deadline'),
        meta: { label: t('goals.deadline') },
      }),
      helper.accessor((g) => (g.accountId ? (accountName.get(g.accountId) ?? '') : ''), {
        id: 'account',
        header: t('goals.account'),
        meta: { label: t('goals.account') },
      }),
    ])
    if (!canWrite) return base
    return [
      ...base,
      helper.display({
        id: 'actions',
        header: () => <span className="sr-only">{t('directories.actions')}</span>,
        enableHiding: false,
        cell: ({ row }) => (
          <DirectoryRowActions
            name={row.original.name}
            archived={false}
            onEdit={() => {
              setEditing(row.original)
            }}
            onDelete={() => {
              setDeleting(row.original)
            }}
          />
        ),
      }),
    ]
  }, [t, locale, canWrite, accounts])

  const addButton = canWrite && (
    <Button
      onClick={() => {
        save.reset()
        setEditing('new')
      }}
    >
      <Plus aria-hidden />
      {t('goals.add')}
    </Button>
  )

  return (
    <DirectoryPage
      title={t('goals.title')}
      description={t('goals.description')}
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
        title: editing === 'new' ? t('goals.newTitle') : t('goals.editTitle'),
        onClose: () => {
          setEditing(null)
        },
        content: editing !== null && (
          <GoalForm
            key={editing === 'new' ? 'new' : editing.id}
            goal={editing === 'new' ? undefined : editing}
            currencies={currencies}
            accounts={accounts}
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
      <DataTable
        data={query.data ?? []}
        columns={columns}
        rowLabel={(goal) => goal.name}
        onReorder={
          canWrite
            ? (ids) => {
                reorder.mutate(ids)
              }
            : undefined
        }
        initialVisibility={{ deadline: false, account: false }}
        empty={
          <EmptyState
            icon={Target}
            title={t('goals.emptyTitle')}
            description={t('goals.emptyText')}
            action={addButton}
          />
        }
      />
    </DirectoryPage>
  )
}
