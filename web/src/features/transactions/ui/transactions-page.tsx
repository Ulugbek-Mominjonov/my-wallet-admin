import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { Account } from '@/entities/account'
import { categoryTree, type Category } from '@/entities/category'
import { useCan } from '@/entities/household'
import type { Tag } from '@/entities/tag'
import type { Transaction } from '@/entities/transaction'
import {
  deleteTransaction,
  saveTransaction,
  transactionsKey,
  transactionsQuery,
  transactionsSummaryQuery,
  type TransactionsSummary,
} from '@/features/transactions/api/transactions-api'
import {
  activeFilterCount,
  clearFilters,
  toRpcFilters,
  type TransactionSearch,
} from '@/features/transactions/model/filters'
import { transactionName } from '@/features/transactions/model/labels'
import type { TransactionInput } from '@/features/transactions/model/transaction-form'
import { TransactionFiltersBar } from '@/features/transactions/ui/transaction-filters'
import { TransactionForm, type DebtOption } from '@/features/transactions/ui/transaction-form'
import {
  TransactionsTable,
  type TransactionLookup,
} from '@/features/transactions/ui/transactions-table'
import { qk } from '@/shared/api/query-keys'
import type { MonthKey } from '@/shared/lib/month'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState } from '@/shared/ui/empty-state'
import type { FilterOption } from '@/shared/ui/filter-multi-select'
import { MoneyText } from '@/shared/ui/money-text'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/**
 * E23-T01, T02: amallar — filtrlar URL'da, keyset sahifalar ("Yana yuklash"),
 * jami alohida yengil so'rovdan; yaratish/tahrirlash — yon paneldagi forma.
 * Spravochniklar marshrutdan keladi.
 */
export function TransactionsPage({
  householdId,
  search,
  onSearchChange,
  currentMonth,
  today,
  baseCurrency,
  accounts,
  categories,
  tags,
  members,
  debts,
}: {
  householdId: string
  search: TransactionSearch
  onSearchChange: (next: TransactionSearch) => void
  currentMonth: MonthKey
  /** Bugun (`YYYY-MM-DD`) byudjet vaqt zonasida — yangi amal sanasi. */
  today: string
  baseCurrency: string
  accounts: readonly Account[]
  categories: readonly Category[]
  tags: readonly Tag[]
  /** A'zolar: `value` — foydalanuvchi ID, `label` — ism. */
  members: readonly FilterOption[]
  debts: readonly DebtOption[]
}) {
  const { t } = useTranslation()
  const canWrite = useCan('write')
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  // Amal qoldiq, hisobot, limit, qarzlarga ta'sir qiladi: ro'yxat darhol
  // yangilanadi, byudjetning qolgan keshlari — keyingi ochilishda.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: transactionsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: qk.household(householdId), refetchType: 'none' }),
    ])
  const save = useMutation({
    mutationFn: (input: TransactionInput) =>
      saveTransaction(
        householdId,
        editing === null || editing === 'new' ? null : editing.id,
        input,
      ),
    onSuccess: async () => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await refresh()
    },
    meta: { silent: true },
  })
  const remove = useMutation({
    mutationFn: (row: Transaction) => deleteTransaction(row.id),
    onSuccess: async () => {
      toast.success(t('directories.deleted'))
      await refresh()
    },
    onSettled: () => {
      setDeleting(null)
    },
  })
  const filters = toRpcFilters(search, currentMonth)
  // Filtr o'zgarganda eski natija ko'rinib turadi (sakrash yo'q), xiralashtiriladi.
  const list = useInfiniteQuery({
    ...transactionsQuery(householdId, filters),
    placeholderData: keepPreviousData,
  })
  const summary = useQuery({
    ...transactionsSummaryQuery(householdId, filters),
    placeholderData: keepPreviousData,
  })

  const lookup = useMemo<TransactionLookup>(
    () => ({
      accounts: new Map(accounts.map((a) => [a.id, a])),
      categories: new Map(categories.map((c) => [c.id, c])),
      tags: new Map(tags.map((tag) => [tag.id, tag])),
      members: new Map(members.map((m) => [m.value, m.label])),
    }),
    [accounts, categories, tags, members],
  )
  const options = useMemo(
    () => ({
      accounts: accounts.map((a) => ({ value: a.id, label: a.name })),
      categories: categoryTree(categories).map((c) => ({
        value: c.id,
        label: c.name,
        depth: c.depth,
      })),
      members,
      tags: tags.map((tag) => ({ value: tag.id, label: tag.name })),
    }),
    [accounts, categories, tags, members],
  )

  const rows = list.data?.pages.flat() ?? []
  const filtered = activeFilterCount(search) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('transactions.title')}
        description={t('transactions.description')}
        actions={
          canWrite && (
            <Button
              onClick={() => {
                save.reset()
                setEditing('new')
              }}
            >
              <Plus aria-hidden />
              {t('transactions.add')}
            </Button>
          )
        }
      />
      <TransactionFiltersBar
        search={search}
        onChange={onSearchChange}
        currentMonth={currentMonth}
        options={options}
        currency={baseCurrency}
      />
      {summary.data && <SummaryBar summary={summary.data} currency={baseCurrency} />}
      {list.isPending ? (
        <TableSkeleton />
      ) : list.error ? (
        <QueryError
          error={list.error}
          onRetry={() => {
            void list.refetch()
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={filtered ? t('transactions.emptyFiltered') : t('transactions.empty')}
          description={filtered ? undefined : t('transactions.emptyHint')}
          action={
            filtered && (
              <Button
                variant="outline"
                onClick={() => {
                  onSearchChange(clearFilters(search))
                }}
              >
                {t('transactions.resetFilters')}
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          <TransactionsTable
            rows={rows}
            lookup={lookup}
            baseCurrency={baseCurrency}
            busy={list.isPlaceholderData}
            actions={
              canWrite
                ? {
                    onEdit: (row) => {
                      save.reset()
                      setEditing(row)
                    },
                    onDelete: setDeleting,
                  }
                : undefined
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {summary.data && (
              <p className="text-sm text-muted-foreground">
                {t('transactions.shown', { shown: rows.length, total: summary.data.count })}
              </p>
            )}
            {list.hasNextPage && (
              <Button
                variant="outline"
                disabled={list.isFetchingNextPage}
                onClick={() => {
                  void list.fetchNextPage()
                }}
              >
                {t('transactions.loadMore')}
              </Button>
            )}
          </div>
        </div>
      )}

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editing === 'new' ? t('transactions.newTitle') : t('transactions.editTitle')}
            </SheetTitle>
          </SheetHeader>
          {editing !== null && (
            <TransactionForm
              key={editing === 'new' ? 'new' : editing.id}
              householdId={householdId}
              transaction={editing === 'new' ? undefined : editing}
              accounts={accounts}
              categories={categories}
              tags={tags}
              debts={debts}
              baseCurrency={baseCurrency}
              today={today}
              pending={save.isPending}
              error={save.error}
              onSubmit={(input) => {
                save.mutate(input)
              }}
              onCancel={() => {
                setEditing(null)
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t('transactions.deleteTitle')}
        description={
          deleting && (
            <>
              <span className="font-medium">
                {transactionName(
                  deleting,
                  deleting.categoryId === null
                    ? undefined
                    : lookup.categories.get(deleting.categoryId),
                  t('transactions.transfer'),
                )}
              </span>
              {' — '}
              {t('transactions.deleteText')}
            </>
          )
        }
        confirmLabel={t('directories.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting)
        }}
      />
    </div>
  )
}

/** Filtr bo'yicha jami (asosiy valyutada) — jadvaldagi sahifalardan qat'i nazar. */
function SummaryBar({ summary, currency }: { summary: TransactionsSummary; currency: string }) {
  const { t } = useTranslation()
  return (
    <section aria-label={t('transactions.summary.label')} className="rounded-lg border p-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryItem label={t('transactions.summary.count')}>
          <span className="tabular-nums">{summary.count}</span>
        </SummaryItem>
        <SummaryItem label={t('transactions.summary.income')}>
          <MoneyText amount={summary.income} currency={currency} tone="income" />
        </SummaryItem>
        <SummaryItem label={t('transactions.summary.expense')}>
          <MoneyText amount={summary.expense} currency={currency} tone="expense" />
        </SummaryItem>
        <SummaryItem label={t('transactions.summary.transfer')}>
          <MoneyText amount={summary.transfer} currency={currency} />
        </SummaryItem>
      </dl>
    </section>
  )
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{children}</dd>
    </div>
  )
}
