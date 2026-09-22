import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ParseKeys } from 'i18next'
import { CalendarCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { Account } from '@/entities/account'
import type { Category } from '@/entities/category'
import { useCan } from '@/entities/household'
import { planBoard, SOON_DAYS, type PlannedItem } from '@/entities/planned-item'
import {
  bulkPayPlanned,
  payPlanned,
  plansKey,
  plansQuery,
  skipPlanned,
  type PayInput,
} from '@/features/plans/api/plans-api'
import { BulkPayDialog } from '@/features/plans/ui/bulk-pay-dialog'
import { PayDialog } from '@/features/plans/ui/pay-dialog'
import { PlanSection } from '@/features/plans/ui/plan-section'
import { businessErrorMessage, skippedSummary } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import type { MonthKey } from '@/shared/lib/month'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { MonthStepper } from '@/shared/ui/month-stepper'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

export type PlansTab = 'expense' | 'income'

const SECTIONS = ['overdue', 'today', 'soon', 'later', 'paid', 'skipped'] as const
const NO_SELECTION: ReadonlySet<string> = new Set()

/** `bulk_pay_planned` sabab kodlari (contracts/api.md) → matn. */
const BULK_PAY_REASONS: Record<string, ParseKeys> = {
  not_found: 'plans.errors.notFound',
  skipped: 'plans.errors.skipped',
  already_paid: 'plans.errors.alreadyPaid',
  amount_unknown: 'plans.errors.amountUnknown',
  account_required: 'plans.errors.accountRequired',
  account_not_found: 'plans.errors.accountNotFound',
  currency_mismatch: 'plans.errors.currencyMismatch',
}

/**
 * E23-T04: oy rejalari — to'lovlar (ajratma bilan) va kutilayotgan daromadlar
 * tablari, holat bo'limlari, jami `X + N ta ?` (BR-076), "To'landi"/"Keldi",
 * o'tkazib yuborish va ommaviy to'lash (BR-074).
 */
export function PlansPage({
  householdId,
  month,
  tab,
  onMonthChange,
  onTabChange,
  currentMonth,
  today,
  baseCurrency,
  accounts,
  categories,
}: {
  householdId: string
  month: MonthKey
  tab: PlansTab
  onMonthChange: (month: MonthKey) => void
  onTabChange: (tab: PlansTab) => void
  currentMonth: MonthKey
  /** Bugun (`YYYY-MM-DD`) byudjet vaqt zonasida — holatlar shundan (BR-002). */
  today: string
  baseCurrency: string
  accounts: readonly Account[]
  categories: readonly Category[]
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const canWrite = useCan('write')
  const queryClient = useQueryClient()
  const query = useQuery(plansQuery(householdId, month))
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  // To'lov byudjet hisobidan (👤 fond — faqat ajratma manzili, BR-061).
  const payAccounts = useMemo(
    () => accounts.filter((a) => a.archivedAt === null && a.type !== 'personal_fund'),
    [accounts],
  )
  const [paying, setPaying] = useState<PlannedItem | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  // Tanlov oy va tabga bog'langan.
  const selectionKey = `${month}:${tab}`
  const [selection, setSelection] = useState({ key: selectionKey, ids: NO_SELECTION })
  const selected = selection.key === selectionKey ? selection.ids : NO_SELECTION
  const select = (ids: ReadonlySet<string>) => {
    setSelection({ key: selectionKey, ids })
  }

  // To'lov amal yozadi: qoldiq, hisobot, amallar ro'yxati ham o'zgaradi.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: plansKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: qk.household(householdId), refetchType: 'none' }),
    ])
  const pay = useMutation({
    mutationFn: ({ plan, input }: { plan: PlannedItem; input: PayInput }) =>
      payPlanned(plan.id, input),
    onSuccess: async (_, { plan }) => {
      setPaying(null)
      toast.success(t('plans.paid', { name: plan.name }))
      await refresh()
    },
    meta: { silent: true },
  })
  const skip = useMutation({
    mutationFn: ({ plan, skipped }: { plan: PlannedItem; skipped: boolean }) =>
      skipPlanned(plan.id, skipped),
    onSuccess: async (_, { plan, skipped }) => {
      toast.success(t(skipped ? 'plans.skippedToast' : 'plans.restored', { name: plan.name }))
      await refresh()
    },
  })
  const bulkPay = useMutation({
    mutationFn: ({
      ids,
      date,
      accountId,
    }: {
      ids: string[]
      date: string
      accountId: string | null
    }) => bulkPayPlanned(ids, { date, accountId }),
    onSuccess: async (result) => {
      setBulkOpen(false)
      if (result.skipped.length === 0) {
        toast.success(t('plans.bulk.done', { count: result.paid.length }))
      } else {
        toast.warning(
          t('plans.bulk.partial', { done: result.paid.length, skipped: result.skipped.length }),
          {
            description: skippedSummary(result.skipped, (reason) => {
              const key = BULK_PAY_REASONS[reason]
              return key ? t(key) : businessErrorMessage(reason)
            }),
          },
        )
      }
      // To'lanmaganlari tanlangan qoladi — alohida to'lash uchun.
      select(new Set(result.skipped.map((s) => s.id)))
      await refresh()
    },
  })

  const items = (query.data ?? []).filter((p) => (p.kind === 'income') === (tab === 'income'))
  const board = planBoard(items, today)
  const actions = canWrite
    ? {
        selected,
        onSelect: select,
        onPay: (plan: PlannedItem) => {
          pay.reset()
          setPaying(plan)
        },
        onSkip: (plan: PlannedItem, skipped: boolean) => {
          skip.mutate({ plan, skipped })
        },
      }
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader title={t('plans.title')} description={t('plans.description')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthStepper value={month} current={currentMonth} onChange={onMonthChange} />
        <Tabs
          value={tab}
          onValueChange={(value: PlansTab) => {
            onTabChange(value)
          }}
        >
          <TabsList>
            <TabsTrigger value="expense">{t('plans.tabs.expense')}</TabsTrigger>
            <TabsTrigger value="income">{t('plans.tabs.income')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {query.isPending ? (
        <TableSkeleton />
      ) : query.error ? (
        <QueryError
          error={query.error}
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t('plans.empty')}
          description={t('plans.emptyHint')}
        />
      ) : (
        <div className="space-y-6">
          <p className="text-sm">
            <span className="text-muted-foreground">{t(`plans.summary.${tab}`)}: </span>
            <span className="font-semibold tabular-nums">
              {formatMoney(board.unpaid, { currency: baseCurrency, locale })}
            </span>
            {board.unknownCount > 0 && (
              <span className="font-semibold">
                {' '}
                {t('plans.summary.unknown', { count: board.unknownCount })}
              </span>
            )}
          </p>
          {selected.size > 0 && (
            <div
              role="region"
              aria-label={t('plans.bulk.selected', { count: selected.size })}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2"
            >
              <span className="px-2 text-sm font-medium">
                {t('plans.bulk.selected', { count: selected.size })}
              </span>
              <Button
                disabled={bulkPay.isPending}
                onClick={() => {
                  setBulkOpen(true)
                }}
              >
                {t('plans.bulk.pay')}
              </Button>
              <Button
                variant="ghost"
                className="ml-auto"
                onClick={() => {
                  select(NO_SELECTION)
                }}
              >
                <X aria-hidden />
                {t('plans.bulk.clear')}
              </Button>
            </div>
          )}
          {SECTIONS.map(
            (section) =>
              board[section].length > 0 && (
                <PlanSection
                  key={section}
                  id={section}
                  title={t(`plans.sections.${section}`, { days: SOON_DAYS })}
                  items={board[section]}
                  today={today}
                  categories={categoriesById}
                  baseCurrency={baseCurrency}
                  actions={actions}
                />
              ),
          )}
        </div>
      )}

      {paying && (
        <PayDialog
          plan={paying}
          accounts={payAccounts}
          baseCurrency={baseCurrency}
          today={today}
          pending={pay.isPending}
          error={pay.error}
          onPay={(input) => {
            pay.mutate({ plan: paying, input })
          }}
          onClose={() => {
            setPaying(null)
          }}
        />
      )}
      {bulkOpen && (
        <BulkPayDialog
          count={selected.size}
          accounts={payAccounts}
          baseCurrency={baseCurrency}
          today={today}
          pending={bulkPay.isPending}
          onPay={({ date, accountId }) => {
            bulkPay.mutate({ ids: [...selected], date, accountId })
          }}
          onClose={() => {
            setBulkOpen(false)
          }}
        />
      )}
    </div>
  )
}
