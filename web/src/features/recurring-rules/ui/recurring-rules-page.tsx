import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CalendarSearch, Plus, Repeat } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { Category } from '@/entities/category'
import { useCan } from '@/entities/household'
import type { RecurringRule } from '@/entities/recurring-rule'
import {
  createRecurringRule,
  deleteRecurringRule,
  recurringRulesKey,
  recurringRulesQuery,
  reorderRecurringRules,
  setRecurringRuleActive,
  updateRecurringRule,
  type RecurringRuleInput,
} from '@/features/recurring-rules/api/recurring-rules-api'
import { MonthPreviewDialog } from '@/features/recurring-rules/ui/month-preview-dialog'
import { RuleForm, type AccountOption } from '@/features/recurring-rules/ui/rule-form'
import { optimisticList } from '@/shared/api/optimistic'
import { useOptimisticRemove, useOptimisticReorder } from '@/shared/api/use-directory-mutations'
import { useAppLocale } from '@/shared/i18n'
import { currentMonthKey, formatMonth, shiftMonth } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DataTable } from '@/shared/ui/data-table/data-table'
import { createDataTableColumns } from '@/shared/ui/data-table/features'
import { DirectoryPage } from '@/shared/ui/directory-page'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { EmptyState } from '@/shared/ui/empty-state'
import { MoneyText } from '@/shared/ui/money-text'
import { Switch } from '@/shared/ui/switch'

const helper = createDataTableColumns<RecurringRule>()

interface RuleActions {
  onEdit: (rule: RecurringRule) => void
  onToggle: (rule: RecurringRule) => void
  onDelete: (rule: RecurringRule) => void
}

/**
 * E22-T04: doimiy rejalar (BR-080..083) — tur, kategoriya, hisob, summa
 * (bo'sh — o'zgaruvchan), kun, avto to'lov, faol/to'xtatilgan, davr;
 * "keyingi oyda nima yaratiladi" preview'i.
 */
export function RecurringRulesPage({
  householdId,
  categories,
  accounts,
  baseCurrency,
  timezone,
}: {
  householdId: string
  categories: readonly Category[]
  accounts: readonly AccountOption[]
  baseCurrency: string
  timezone: string
}) {
  const { t } = useTranslation()
  const canManage = useCan('manage')
  const queryClient = useQueryClient()
  const list = recurringRulesQuery(householdId)
  const query = useQuery(list)
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null)
  const [deleting, setDeleting] = useState<RecurringRule | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const allRules = recurringRulesKey(householdId)
  const nextMonth = `${shiftMonth(currentMonthKey(new Date(), timezone), 1)}-01`

  const save = useMutation({
    mutationFn: async (input: RecurringRuleInput) => {
      if (editing === null || editing === 'new') {
        const last = Math.max(-1, ...(query.data ?? []).map((r) => r.sortOrder))
        await createRecurringRule(householdId, input, last + 1)
      } else {
        await updateRecurringRule(editing.id, input)
      }
    },
    onSuccess: async () => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await queryClient.invalidateQueries({ queryKey: allRules })
    },
    meta: { silent: true },
  })

  // Faol/to'xtatilgan — jadvalda darhol (arxiv o'rniga, BR-082).
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setRecurringRuleActive(id, active),
    ...optimisticList<RecurringRule, { id: string; active: boolean }>(
      queryClient,
      list.queryKey,
      (items, { id, active }) => items.map((r) => (r.id === id ? { ...r, active } : r)),
    ),
  })
  const remove = useOptimisticRemove<RecurringRule>({
    listKey: list.queryKey,
    allKey: allRules,
    remove: deleteRecurringRule,
  })
  const reorder = useOptimisticReorder<RecurringRule>({
    listKey: list.queryKey,
    allKey: allRules,
    reorder: (ids) => reorderRecurringRules(householdId, ids),
  })

  const { mutate: toggleRule } = toggle
  const onToggle = useCallback(
    (rule: RecurringRule) => {
      toggleRule({ id: rule.id, active: !rule.active })
    },
    [toggleRule],
  )
  const columns = useRuleColumns(canManage, categories, accounts, baseCurrency, {
    onEdit: setEditing,
    onToggle,
    onDelete: setDeleting,
  })

  const addButton = canManage && (
    <Button
      onClick={() => {
        save.reset()
        setEditing('new')
      }}
    >
      <Plus aria-hidden />
      {t('rules.add')}
    </Button>
  )

  return (
    <DirectoryPage
      title={t('rules.title')}
      description={t('rules.description')}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => {
              setPreviewOpen(true)
            }}
          >
            <CalendarSearch aria-hidden />
            {t('rules.preview')}
          </Button>
          {addButton}
        </>
      }
      status={{
        isPending: query.isPending,
        error: query.error,
        onRetry: () => {
          void query.refetch()
        },
      }}
      form={{
        open: editing !== null,
        title: editing === 'new' ? t('rules.newTitle') : t('rules.editTitle'),
        onClose: () => {
          setEditing(null)
        },
        content: editing !== null && (
          <RuleForm
            key={editing === 'new' ? 'new' : editing.id}
            rule={editing === 'new' ? undefined : editing}
            categories={categories}
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
      dialogs={
        <MonthPreviewDialog
          householdId={householdId}
          month={nextMonth}
          currency={baseCurrency}
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false)
          }}
        />
      }
    >
      <DataTable
        data={query.data ?? []}
        columns={columns}
        rowLabel={(rule) => rule.name}
        onReorder={
          canManage
            ? (ids) => {
                reorder.mutate(ids)
              }
            : undefined
        }
        initialVisibility={{ period: false }}
        empty={
          <EmptyState
            icon={Repeat}
            title={t('rules.emptyTitle')}
            description={t('rules.emptyText')}
            action={addButton}
          />
        }
      />
    </DirectoryPage>
  )
}

function useRuleColumns(
  canManage: boolean,
  categories: readonly Category[],
  accounts: readonly AccountOption[],
  currency: string,
  actions: RuleActions,
) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const { onEdit, onToggle, onDelete } = actions

  return useMemo(() => {
    const categoryName = new Map(categories.map((c) => [c.id, c.name]))
    const accountName = new Map(accounts.map((a) => [a.id, a.name]))
    const month = (value: string | null) => (value ? formatMonth(value.slice(0, 7), locale) : null)
    const columns = helper.columns([
      helper.accessor('name', {
        header: t('rules.name'),
        enableHiding: false,
        cell: ({ row }) =>
          canManage ? (
            <button
              type="button"
              className="truncate rounded-md text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => {
                onEdit(row.original)
              }}
            >
              {row.original.name}
            </button>
          ) : (
            <span className="truncate font-medium">{row.original.name}</span>
          ),
      }),
      helper.accessor((rule) => t(`rules.kinds.${rule.kind}`), {
        id: 'kind',
        header: t('rules.kind'),
        meta: { label: t('rules.kind') },
      }),
      helper.accessor(
        (rule) => (rule.categoryId ? (categoryName.get(rule.categoryId) ?? '') : ''),
        {
          id: 'category',
          header: t('rules.category'),
          meta: { label: t('rules.category') },
        },
      ),
      helper.accessor((rule) => (rule.accountId ? (accountName.get(rule.accountId) ?? '') : ''), {
        id: 'account',
        header: t('rules.account'),
        meta: { label: t('rules.account') },
      }),
      helper.accessor('amount', {
        header: t('rules.amount'),
        meta: { label: t('rules.amount'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) =>
          row.original.amount === null ? (
            <span className="text-muted-foreground">{t('rules.varies')}</span>
          ) : (
            <MoneyText
              amount={row.original.amount}
              currency={currency}
              tone={row.original.kind === 'income' ? 'income' : 'neutral'}
            />
          ),
      }),
      helper.accessor('dayOfMonth', {
        header: t('rules.day'),
        meta: { label: t('rules.day') },
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-2 whitespace-nowrap">
            {t('rules.dayValue', { day: row.original.dayOfMonth })}
            {row.original.autoPay && (
              <Badge variant="secondary">
                <CalendarClock aria-hidden />
                {t('rules.autoPay')}
              </Badge>
            )}
          </span>
        ),
      }),
      helper.accessor(
        (rule) => {
          const from = month(rule.startMonth)
          const to = month(rule.endMonth)
          if (from && to) return t('rules.range', { from, to })
          if (from) return t('rules.from', { month: from })
          if (to) return t('rules.until', { month: to })
          return t('rules.always')
        },
        { id: 'period', header: t('rules.period'), meta: { label: t('rules.period') } },
      ),
      helper.accessor('active', {
        header: t('rules.active'),
        meta: { label: t('rules.active') },
        enableGlobalFilter: false,
        cell: ({ row }) =>
          canManage ? (
            <Switch
              checked={row.original.active}
              aria-label={`${row.original.name}: ${t('rules.active')}`}
              onCheckedChange={() => {
                onToggle(row.original)
              }}
            />
          ) : (
            <span className={row.original.active ? undefined : 'text-muted-foreground'}>
              {row.original.active ? t('rules.active') : t('rules.inactive')}
            </span>
          ),
      }),
    ])
    if (!canManage) return columns
    return [
      ...columns,
      helper.display({
        id: 'actions',
        header: () => <span className="sr-only">{t('directories.actions')}</span>,
        enableHiding: false,
        cell: ({ row }) => (
          <DirectoryRowActions
            name={row.original.name}
            archived={false}
            onEdit={() => {
              onEdit(row.original)
            }}
            onDelete={() => {
              onDelete(row.original)
            }}
          />
        ),
      }),
    ]
  }, [t, locale, canManage, categories, accounts, currency, onEdit, onToggle, onDelete])
}
