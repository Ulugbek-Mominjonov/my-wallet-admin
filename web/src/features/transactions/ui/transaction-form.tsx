import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { Account } from '@/entities/account'
import { categoryTree, type Category } from '@/entities/category'
import type { PlanKind } from '@/entities/recurring-rule'
import type { Tag } from '@/entities/tag'
import {
  autoBudgetMonth,
  TRANSACTION_KINDS,
  type Transaction,
  type TransactionKind,
} from '@/entities/transaction'
import {
  fxRateQuery,
  linkablePlansQuery,
  monthClosedQuery,
  PAYEE_QUERY_MIN,
  payeeSuggestionsQuery,
  type LinkablePlan,
} from '@/features/transactions/api/transactions-api'
import {
  NOTE_MAX,
  PAYEE_MAX,
  transactionFormDefaults,
  transactionFormSchema,
  type TransactionInput,
} from '@/features/transactions/model/transaction-form'
import { ReceiptList } from '@/features/transactions/ui/receipt-list'
import { toAppError } from '@/shared/api/errors'
import type { Constants } from '@/shared/api/database.types'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney, formatMoneyInput } from '@/shared/lib/money'
import { formatMonth, isMonthKey, shiftMonth, type MonthKey } from '@/shared/lib/month'
import { useDebouncedValue } from '@/shared/lib/use-debounced-value'
import { AmountField } from '@/shared/ui/amount-field'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FilterMultiSelect } from '@/shared/ui/filter-multi-select'
import { FormCombobox } from '@/shared/ui/form-combobox'
import { FormSelect } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'

export interface DebtOption {
  id: string
  name: string
  direction: (typeof Constants.public.Enums.debt_direction)[number]
  archived: boolean
}

/** Tanlovdagi "bog'lanmagan" bandi (FormSelect bo'sh qiymatni ko'rsatmaydi). */
const NONE = 'none'
/** Qo'lda oy tanlovi: amal sanasidan orqaga/oldinga. */
const MONTHS_BEFORE = 12
const MONTHS_AFTER = 1
const PAYEE_DEBOUNCE_MS = 250

/** Amal turi ↔ reja turi (BR-061: ajratma — fondga o'tkazma). */
const PLAN_KIND: Record<TransactionKind, PlanKind> = {
  expense: 'expense',
  income: 'income',
  transfer: 'allocation',
}
/** BR-111: xarajat — men qarzdor qarzga, daromad — menga qarzdor qarzga. */
const DEBT_DIRECTION: Partial<Record<TransactionKind, DebtOption['direction']>> = {
  expense: 'i_owe',
  income: 'owed_to_me',
}

/**
 * E23-T02: amal formasi (BR-050..056). Tegishli oy jonli ko'rsatiladi va
 * qo'lda almashtiriladi (BR-045); joy nomi tarixdan to'ldiriladi (BR-056);
 * yopilgan oy — ogohlantirish (BR-055). Yozuvda qoidalarni server tekshiradi.
 */
export function TransactionForm({
  householdId,
  transaction,
  accounts,
  categories,
  tags,
  debts,
  baseCurrency,
  today,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  householdId: string
  transaction?: Transaction
  accounts: readonly Account[]
  categories: readonly Category[]
  tags: readonly Tag[]
  debts: readonly DebtOption[]
  baseCurrency: string
  today: string
  pending: boolean
  error: Error | null
  onSubmit: (input: TransactionInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const schema = useMemo(() => transactionFormSchema((id) => accountsById.get(id)), [accountsById])
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: transactionFormDefaults(transaction, {
      today,
      currencyOf: (id) => accountsById.get(id)?.currency ?? baseCurrency,
    }),
  })
  const errors = form.formState.errors
  const [
    kind,
    accountId,
    toAccountId,
    categoryId,
    occurredOn,
    manualMonth,
    budgetMonth,
    payee,
    plannedItemId,
  ] = useWatch({
    control: form.control,
    name: [
      'kind',
      'accountId',
      'toAccountId',
      'categoryId',
      'occurredOn',
      'manualMonth',
      'budgetMonth',
      'payee',
      'plannedItemId',
    ],
  })

  const account = accountsById.get(accountId)
  const target = accountsById.get(toAccountId)
  const currency = account?.currency ?? baseCurrency
  const category = categoriesById.get(categoryId)
  // Rejalar tanlovi — reja bog'lanmagandagi oy uchun (sana va kategoriyadan).
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(occurredOn) ? occurredOn : today
  const ruleMonth = autoBudgetMonth({
    kind,
    occurredOn: validDate,
    monthShift: category?.monthShift ?? 0,
    planMonth: null,
  })
  const plans = useQuery(linkablePlansQuery(householdId, ruleMonth))
  // BR-193: boshqa valyutadagi hisobda sanadagi kurs ko'rsatiladi.
  const rate = useQuery({
    ...fxRateQuery(householdId, currency, validDate),
    enabled: currency !== baseCurrency,
  })
  const autoRate = rate.data ?? null
  const plan = plans.data?.find((p) => p.id === plannedItemId)
  // BR-044: rejaga bog'langan amal — reja oyiga.
  const autoMonth = autoBudgetMonth({
    kind,
    occurredOn: validDate,
    monthShift: category?.monthShift ?? 0,
    planMonth: plan?.budgetMonth ?? null,
  })

  const planLabel = (p: LinkablePlan): string => {
    const name =
      p.budgetMonth === ruleMonth ? p.name : `${p.name} (${formatMonth(p.budgetMonth, locale)})`
    if (p.settled) return `${name} — ${t('transactions.form.settled')}`
    if (p.plannedAmount === null) return `${name} — ?`
    const left = Math.max(p.plannedAmount - p.paidAmount, 0)
    return `${name} — ${t('transactions.form.remaining', {
      amount: formatMoney(left, { currency: baseCurrency, locale }),
    })}`
  }

  // ─── Tanlov ro'yxatlari ───
  // Arxivdagi hisob/kategoriya/qarz faqat shu amalda tanlangan bo'lsa ko'rinadi.
  const accountOptions = accounts
    .filter(
      (a) =>
        (a.archivedAt === null ||
          a.id === transaction?.accountId ||
          a.id === transaction?.toAccountId) &&
        // BR-063: daromad fondga emas.
        !(kind === 'income' && a.type === 'personal_fund'),
    )
    .map((a) => ({
      value: a.id,
      label: a.currency === baseCurrency ? a.name : `${a.name} (${a.currency})`,
    }))
  const categoryOptions = categoryTree(
    categories.filter(
      (c) => c.kind === kind && (c.archivedAt === null || c.id === transaction?.categoryId),
    ),
  ).map((c) => ({ value: c.id, label: c.name, depth: c.depth }))
  const planOptions = [
    { value: NONE, label: t('transactions.form.none') },
    ...(plans.data ?? [])
      .filter((p) => p.kind === PLAN_KIND[kind])
      .map((p) => ({ value: p.id, label: planLabel(p) })),
  ]
  const direction = DEBT_DIRECTION[kind]
  const debtOptions = [
    { value: NONE, label: t('transactions.form.none') },
    ...debts
      .filter((d) => d.direction === direction && (!d.archived || d.id === transaction?.debtId))
      .map((d) => ({ value: d.id, label: d.name })),
  ]

  // ─── Joy nomi takliflari (BR-056) ───
  const payeeQuery = useDebouncedValue(payee, PAYEE_DEBOUNCE_MS)
  const suggestions = useQuery({
    ...payeeSuggestionsQuery(householdId, payeeQuery, kind),
    enabled: kind !== 'transfer' && payeeQuery.trim().length >= PAYEE_QUERY_MIN,
  })
  const applySuggestion = (value: string) => {
    const match = suggestions.data?.find(
      (s) => s.payee.toLowerCase() === value.trim().toLowerCase(),
    )
    if (!match) return
    // Foydalanuvchi tanlagan qiymat ustiga yozilmaydi.
    if (form.getValues('categoryId') === '' && match.categoryId !== null) {
      form.setValue('categoryId', match.categoryId, { shouldDirty: true })
    }
    if (
      form.getValues('accountId') === '' &&
      accountsById.get(match.accountId)?.archivedAt === null
    ) {
      form.setValue('accountId', match.accountId, { shouldDirty: true })
    }
  }

  const changeKind = (next: TransactionKind) => {
    form.setValue('kind', next, { shouldDirty: true })
    if (categoriesById.get(form.getValues('categoryId'))?.kind !== next) {
      form.setValue('categoryId', '')
    }
    form.setValue('plannedItemId', '')
    form.setValue('debtId', '')
  }

  const choosePlan = (id: string) => {
    const chosen = plans.data?.find((p) => p.id === id)
    form.setValue('plannedItemId', chosen ? id : '', { shouldDirty: true })
    if (!chosen) return
    if (form.getValues('categoryId') === '' && chosen.categoryId !== null) {
      form.setValue('categoryId', chosen.categoryId)
    }
    if (chosen.debtId !== null) form.setValue('debtId', chosen.debtId)
    // Qolgan summa asosiy valyutada — hisob ham shu valyutada bo'lsa to'ldiriladi.
    const left = chosen.plannedAmount === null ? 0 : chosen.plannedAmount - chosen.paidAmount
    if (form.getValues('amount').trim() === '' && left > 0 && currency === baseCurrency) {
      form.setValue('amount', formatMoneyInput(left, baseCurrency))
    }
  }

  const fieldError = (id: string, message: string | false | undefined) =>
    message ? (
      <p id={id} className="text-sm text-destructive">
        {message}
      </p>
    ) : null

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
    >
      <div role="group" aria-label={t('transactions.form.kind')} className="grid grid-cols-3 gap-1">
        {TRANSACTION_KINDS.map((value) => (
          <Button
            key={value}
            type="button"
            variant={kind === value ? 'secondary' : 'outline'}
            aria-pressed={kind === value}
            onClick={() => {
              changeKind(value)
            }}
          >
            {t(`transactions.kinds.${value}`)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <AmountField
          id="tx-amount"
          label={`${t('transactions.form.amount')} (${currency})`}
          error={errors.amount ? t('transactions.errors.amount') : undefined}
          registration={form.register('amount')}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="tx-date">{t('transactions.form.date')}</Label>
          <Input
            id="tx-date"
            type="date"
            aria-invalid={errors.occurredOn ? true : undefined}
            aria-describedby={errors.occurredOn ? 'tx-date-error' : undefined}
            {...form.register('occurredOn')}
          />
          {fieldError('tx-date-error', errors.occurredOn && t('transactions.errors.date'))}
        </div>
      </div>

      <div className={kind === 'transfer' ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
        <div className="grid gap-1.5">
          <Label id="tx-account-label">
            {kind === 'transfer'
              ? t('transactions.form.fromAccount')
              : t('transactions.form.account')}
          </Label>
          <Controller
            control={form.control}
            name="accountId"
            render={({ field }) => (
              <FormSelect
                labelId="tx-account-label"
                value={field.value}
                options={accountOptions}
                onChange={field.onChange}
                invalid={Boolean(errors.accountId)}
                describedBy={errors.accountId ? 'tx-account-error' : undefined}
              />
            )}
          />
          {fieldError(
            'tx-account-error',
            errors.accountId &&
              (errors.accountId.message === 'fund'
                ? t('transactions.errors.fund')
                : t('transactions.errors.account')),
          )}
        </div>
        {kind === 'transfer' && (
          <div className="grid gap-1.5">
            <Label id="tx-to-account-label">{t('transactions.form.toAccount')}</Label>
            <Controller
              control={form.control}
              name="toAccountId"
              render={({ field }) => (
                <FormSelect
                  labelId="tx-to-account-label"
                  value={field.value}
                  options={accountOptions.filter((o) => o.value !== accountId)}
                  onChange={field.onChange}
                  invalid={Boolean(errors.toAccountId)}
                  describedBy={errors.toAccountId ? 'tx-to-account-error' : undefined}
                />
              )}
            />
            {fieldError(
              'tx-to-account-error',
              errors.toAccountId && t('transactions.errors.toAccount'),
            )}
          </div>
        )}
      </div>
      {kind === 'transfer' && target && account && target.currency !== account.currency && (
        <AmountField
          id="tx-to-amount"
          label={t('transactions.form.toAmount', { currency: target.currency })}
          error={errors.toAmount ? t('transactions.errors.toAmount') : undefined}
          registration={form.register('toAmount')}
        />
      )}

      {/* BR-193: boshqa valyutadagi hisobda kurs ko'rinadi va qo'lda kiritiladi. */}
      {currency !== baseCurrency && (
        <div className="grid gap-1.5">
          <Label htmlFor="tx-fx-rate">
            {t('transactions.form.fxRate', { currency, base: baseCurrency })}
          </Label>
          <Input
            id="tx-fx-rate"
            inputMode="decimal"
            placeholder={autoRate === null ? t('transactions.form.fxRateNone') : String(autoRate)}
            aria-invalid={errors.fxRate ? true : undefined}
            aria-describedby={errors.fxRate ? 'tx-fx-rate-error' : 'tx-fx-rate-hint'}
            {...form.register('fxRate')}
          />
          <p id="tx-fx-rate-hint" className="text-xs text-muted-foreground">
            {autoRate === null
              ? t('transactions.form.fxRateRequired')
              : t('transactions.form.fxRateHint')}
          </p>
          {fieldError('tx-fx-rate-error', errors.fxRate && t('transactions.errors.fxRate'))}
        </div>
      )}

      {kind !== 'transfer' && (
        <div className="grid gap-1.5">
          <Label id="tx-category-label">{t('transactions.form.category')}</Label>
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormCombobox
                labelId="tx-category-label"
                value={field.value}
                options={categoryOptions}
                onChange={field.onChange}
                placeholder={t('transactions.form.chooseCategory')}
                invalid={Boolean(errors.categoryId)}
                describedBy={errors.categoryId ? 'tx-category-error' : undefined}
              />
            )}
          />
          {fieldError('tx-category-error', errors.categoryId && t('transactions.errors.category'))}
          {kind === 'expense' && account?.type === 'personal_fund' && categoryId === '' && (
            <p className="text-xs text-muted-foreground">
              {t('transactions.form.fundCategoryHint')}
            </p>
          )}
        </div>
      )}

      <BudgetMonthField
        householdId={householdId}
        autoMonth={autoMonth}
        byPlan={plan !== undefined}
        manual={manualMonth}
        dateMonth={shiftMonth(validDate.slice(0, 7), 0)}
        value={budgetMonth}
        invalid={Boolean(errors.budgetMonth)}
        onManualChange={(next) => {
          form.setValue('manualMonth', next, { shouldDirty: true })
          if (next) form.setValue('budgetMonth', autoMonth)
        }}
        onChange={(month) => {
          form.setValue('budgetMonth', month, { shouldDirty: true })
        }}
      />

      {kind !== 'transfer' && (
        <div className="grid gap-1.5">
          <Label htmlFor="tx-payee">{t('transactions.form.payee')}</Label>
          <Input
            id="tx-payee"
            list="tx-payee-suggestions"
            autoComplete="off"
            maxLength={PAYEE_MAX}
            aria-describedby="tx-payee-hint"
            {...form.register('payee', {
              onChange: (event: { target: { value: string } }) => {
                applySuggestion(event.target.value)
              },
            })}
          />
          <datalist id="tx-payee-suggestions">
            {(suggestions.data ?? []).map((s) => (
              <option key={s.payee} value={s.payee} />
            ))}
          </datalist>
          <p id="tx-payee-hint" className="text-xs text-muted-foreground">
            {t('transactions.form.payeeHint')}
          </p>
        </div>
      )}

      <div className={direction ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
        <div className="grid gap-1.5">
          <Label id="tx-plan-label">{t('transactions.form.plan')}</Label>
          <FormSelect
            labelId="tx-plan-label"
            value={plannedItemId === '' ? NONE : plannedItemId}
            options={
              plannedItemId !== '' && !plan
                ? [...planOptions, { value: plannedItemId, label: t('transactions.form.plan') }]
                : planOptions
            }
            onChange={(value) => {
              choosePlan(value === NONE ? '' : value)
            }}
          />
        </div>
        {direction && (
          <div className="grid gap-1.5">
            <Label id="tx-debt-label">{t('transactions.form.debt')}</Label>
            <Controller
              control={form.control}
              name="debtId"
              render={({ field }) => (
                <FormSelect
                  labelId="tx-debt-label"
                  value={field.value === '' ? NONE : field.value}
                  options={debtOptions}
                  onChange={(value) => {
                    field.onChange(value === NONE ? '' : value)
                  }}
                />
              )}
            />
          </div>
        )}
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium">{t('transactions.form.tags')}</span>
        <Controller
          control={form.control}
          name="tagIds"
          render={({ field }) => (
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterMultiSelect
                label={t('transactions.form.tags')}
                options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
                value={field.value}
                onChange={field.onChange}
              />
              {field.value.map((id) => {
                const tag = tags.find((x) => x.id === id)
                return (
                  tag && (
                    <Badge key={id} variant="secondary">
                      {tag.name}
                    </Badge>
                  )
                )
              })}
            </div>
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="tx-note">{t('transactions.form.note')}</Label>
        <Textarea id="tx-note" maxLength={NOTE_MAX} rows={3} {...form.register('note')} />
      </div>

      {transaction?.hasReceipt && (
        <ReceiptList householdId={householdId} transactionId={transaction.id} />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
      <div className="flex justify-end gap-2 pb-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}

/** BR-045: tegishli oy jonli (qoida yoki reja oyi), qo'lda almashtirish va BR-055 ogohlantirishi. */
function BudgetMonthField({
  householdId,
  autoMonth,
  byPlan,
  manual,
  dateMonth,
  value,
  invalid,
  onManualChange,
  onChange,
}: {
  householdId: string
  autoMonth: MonthKey
  byPlan: boolean
  manual: boolean
  dateMonth: MonthKey
  value: string
  invalid: boolean
  onManualChange: (manual: boolean) => void
  onChange: (month: string) => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const month: MonthKey = manual && isMonthKey(value) ? value : autoMonth
  const closed = useQuery(monthClosedQuery(householdId, month))
  const months = Array.from({ length: MONTHS_BEFORE + MONTHS_AFTER + 1 }, (_, i) =>
    shiftMonth(dateMonth, MONTHS_AFTER - i),
  )
  if (!months.includes(month)) months.push(month)

  return (
    <div className="grid gap-1.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id="tx-month-label" className="text-sm font-medium">
          {t('transactions.form.budgetMonth')}
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => {
            onManualChange(!manual)
          }}
        >
          {manual ? t('transactions.form.autoMonth') : t('transactions.form.changeMonth')}
        </Button>
      </div>
      {manual ? (
        <FormSelect
          labelId="tx-month-label"
          value={month}
          options={months.map((m) => ({ value: m, label: formatMonth(m, locale) }))}
          onChange={onChange}
          invalid={invalid}
        />
      ) : (
        <p aria-live="polite" className="text-sm">
          <span className="font-medium">{formatMonth(month, locale)}</span>{' '}
          <span className="text-muted-foreground">
            — {byPlan ? t('transactions.form.monthByPlan') : t('transactions.form.monthByRule')}
          </span>
        </p>
      )}
      {closed.data && (
        <p role="status" className="flex items-start gap-1.5 rounded-md bg-warning/10 p-2 text-sm">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          {t('transactions.form.monthClosed')}
        </p>
      )}
    </div>
  )
}
