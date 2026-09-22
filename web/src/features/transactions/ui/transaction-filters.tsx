import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TRANSACTION_KINDS, type TransactionKind } from '@/entities/transaction'
import {
  activeFilterCount,
  ALL_MONTHS,
  clearFilters,
  periodOf,
  SEARCH_MAX_LENGTH,
  type TransactionSearch,
} from '@/features/transactions/model/filters'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney, formatMoneyInput, parseMoney } from '@/shared/lib/money'
import { formatMonth, isMonthKey, shiftMonth, type MonthKey } from '@/shared/lib/month'
import { Button } from '@/shared/ui/button'
import { FilterMultiSelect, type FilterOption } from '@/shared/ui/filter-multi-select'
import { Input } from '@/shared/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/shared/ui/input-group'
import { Label } from '@/shared/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

export interface TransactionFilterOptions {
  accounts: readonly FilterOption[]
  categories: readonly FilterOption[]
  members: readonly FilterOption[]
  tags: readonly FilterOption[]
}

/** Davr tanlovida ko'rsatiladigan oylar (joriydan orqaga). */
const MONTHS_BACK = 24
/** Davr tanlovidagi "sana oralig'i" bandi (URL'da — `from`/`to`). */
const PERIOD_RANGE = 'range'
/** Qidiruv URL'ga yozilishidan oldingi pauza — har harfda so'rov ketmasin. */
const SEARCH_DEBOUNCE_MS = 300

const LIST_FILTERS = ['accounts', 'categories', 'members', 'tags'] as const

/** E23-T01: amallar filtrlari — hammasi URL'da (`search`), o'zgarish darhol. */
export function TransactionFiltersBar({
  search,
  onChange,
  currentMonth,
  options,
  currency,
}: {
  search: TransactionSearch
  onChange: (next: TransactionSearch) => void
  currentMonth: MonthKey
  options: TransactionFilterOptions
  currency: string
}) {
  const { t } = useTranslation()
  const active = activeFilterCount(search)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodFilter search={search} onChange={onChange} currentMonth={currentMonth} />
        <SearchField
          value={search.q ?? ''}
          onCommit={(q) => {
            onChange({ ...search, q: q === '' ? undefined : q })
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <KindFilter
          value={search.kinds ?? []}
          onChange={(kinds) => {
            onChange({ ...search, kinds: kinds.length === 0 ? undefined : kinds })
          }}
        />
        {LIST_FILTERS.map((key) => (
          <FilterMultiSelect
            key={key}
            label={t(`transactions.filters.${key}`)}
            options={options[key]}
            value={search[key] ?? []}
            onChange={(ids) => {
              onChange({ ...search, [key]: ids.length === 0 ? undefined : ids })
            }}
          />
        ))}
        <AmountFilter
          min={search.min}
          max={search.max}
          currency={currency}
          onChange={(min, max) => {
            onChange({ ...search, min, max })
          }}
        />
        {active > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              onChange(clearFilters(search))
            }}
          >
            <X aria-hidden />
            {t('transactions.filters.clear')}
          </Button>
        )}
      </div>
    </div>
  )
}

function PeriodFilter({
  search,
  onChange,
  currentMonth,
}: {
  search: TransactionSearch
  onChange: (next: TransactionSearch) => void
  currentMonth: MonthKey
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const period = periodOf(search, currentMonth)
  const value =
    period.mode === 'month' ? period.month : period.mode === 'all' ? ALL_MONTHS : PERIOD_RANGE
  const months = Array.from({ length: MONTHS_BACK }, (_, i) => shiftMonth(currentMonth, -i))
  // Eski havoladagi oy ro'yxatda bo'lmasa ham tanlangan ko'rinsin.
  if (period.mode === 'month' && !months.includes(period.month)) months.unshift(period.month)
  const items = [
    ...months.map((month) => ({ value: month, label: formatMonth(month, locale) })),
    { value: ALL_MONTHS, label: t('transactions.period.all') },
    { value: PERIOD_RANGE, label: t('transactions.period.range') },
  ]
  const withoutPeriod = { ...search, month: undefined, from: undefined, to: undefined }
  // Joriy oy — standart: URL toza qoladi.
  const toMonth = (month: MonthKey) => {
    onChange({ ...withoutPeriod, month: month === currentMonth ? undefined : month })
  }
  const select = (next: string) => {
    if (next === PERIOD_RANGE) onChange({ ...withoutPeriod, from: `${currentMonth}-01` })
    else if (next === ALL_MONTHS) onChange({ ...withoutPeriod, month: ALL_MONTHS })
    else if (isMonthKey(next)) toMonth(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {period.mode === 'month' && (
        <Button
          variant="outline"
          size="icon"
          aria-label={t('common.prevMonth')}
          onClick={() => {
            toMonth(shiftMonth(period.month, -1))
          }}
        >
          <ChevronLeft aria-hidden />
        </Button>
      )}
      <Select
        value={value}
        items={items}
        onValueChange={(next: string | null) => {
          if (next !== null) select(next)
        }}
      >
        <SelectTrigger className="w-44" aria-label={t('transactions.period.label')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period.mode === 'month' && (
        <Button
          variant="outline"
          size="icon"
          aria-label={t('common.nextMonth')}
          onClick={() => {
            toMonth(shiftMonth(period.month, 1))
          }}
        >
          <ChevronRight aria-hidden />
        </Button>
      )}
      {period.mode === 'range' && (
        <>
          <DateInput
            label={t('transactions.period.from')}
            value={period.from}
            onChange={(from) => {
              onChange({ ...search, month: undefined, from })
            }}
          />
          <DateInput
            label={t('transactions.period.to')}
            value={period.to}
            onChange={(to) => {
              onChange({ ...search, month: undefined, to })
            }}
          />
        </>
      )}
    </div>
  )
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        className="w-40"
        value={value ?? ''}
        onChange={(event) => {
          onChange(event.target.value === '' ? undefined : event.target.value)
        }}
      />
    </div>
  )
}

/** Qidiruv: yozish paytida mahalliy holat, URL'ga pauzadan keyin. */
function SearchField({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState(value)
  const [committed, setCommitted] = useState(value)
  const timer = useRef<number | undefined>(undefined)
  // Tashqaridan o'zgarsa (tozalash, orqaga) — maydon ham yangilanadi. O'z
  // yozuvimiz (kesilgan) qaytsa — tegilmaydi, aks holda so'z oxiridagi
  // probel yozish paytida o'chib ketardi.
  if (value !== committed) {
    setCommitted(value)
    if (value !== text.trim()) setText(value)
  }
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )

  return (
    <InputGroup className="w-full sm:w-72">
      <InputGroupAddon>
        <Search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={t('transactions.search')}
        placeholder={t('transactions.search')}
        maxLength={SEARCH_MAX_LENGTH}
        value={text}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            onCommit(next.trim())
          }, SEARCH_DEBOUNCE_MS)
        }}
      />
    </InputGroup>
  )
}

function KindFilter({
  value,
  onChange,
}: {
  value: readonly TransactionKind[]
  onChange: (next: TransactionKind[]) => void
}) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('transactions.filters.kinds')} className="flex gap-1">
      {TRANSACTION_KINDS.map((kind) => {
        const pressed = value.includes(kind)
        return (
          <Button
            key={kind}
            variant={pressed ? 'secondary' : 'outline'}
            aria-pressed={pressed}
            onClick={() => {
              onChange(pressed ? value.filter((k) => k !== kind) : [...value, kind])
            }}
          >
            {t(`transactions.kinds.${kind}`)}
          </Button>
        )
      })}
    </div>
  )
}

/** Summa oralig'i (asosiy valyutada) — ikki maydon, "Qo'llash" bilan. */
function AmountFilter({
  min,
  max,
  currency,
  onChange,
}: {
  min: number | undefined
  max: number | undefined
  currency: string
  onChange: (min: number | undefined, max: number | undefined) => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const [open, setOpen] = useState(false)
  const set = min !== undefined || max !== undefined
  const summary = set
    ? `${min === undefined ? '' : formatMoney(min, { currency, locale })} – ${
        max === undefined ? '' : formatMoney(max, { currency, locale })
      }`
    : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" className={set ? undefined : 'border-dashed'} />}
      >
        {t('transactions.filters.amount')}
        {summary && <span className="text-muted-foreground">{summary}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        {open && (
          <AmountForm
            min={min}
            max={max}
            currency={currency}
            onApply={(nextMin, nextMax) => {
              onChange(nextMin, nextMax)
              setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

function AmountForm({
  min,
  max,
  currency,
  onApply,
}: {
  min: number | undefined
  max: number | undefined
  currency: string
  onApply: (min: number | undefined, max: number | undefined) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [minText, setMinText] = useState(min === undefined ? '' : formatMoneyInput(min, currency))
  const [maxText, setMaxText] = useState(max === undefined ? '' : formatMoneyInput(max, currency))
  const [invalid, setInvalid] = useState(false)
  // Bo'sh — chegara yo'q; manfiy yoki son bo'lmasa — xato.
  const read = (text: string): number | undefined | null => {
    if (text.trim() === '') return undefined
    const value = parseMoney(text, currency)
    return value === null || value < 0 ? null : value
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const nextMin = read(minText)
        const nextMax = read(maxText)
        if (nextMin === null || nextMax === null) {
          setInvalid(true)
          return
        }
        onApply(nextMin, nextMax)
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-min`}>{t('transactions.filters.min')}</Label>
          <Input
            id={`${id}-min`}
            inputMode="decimal"
            autoComplete="off"
            value={minText}
            aria-invalid={invalid ? true : undefined}
            onChange={(event) => {
              setMinText(event.target.value)
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-max`}>{t('transactions.filters.max')}</Label>
          <Input
            id={`${id}-max`}
            inputMode="decimal"
            autoComplete="off"
            value={maxText}
            aria-invalid={invalid ? true : undefined}
            onChange={(event) => {
              setMaxText(event.target.value)
            }}
          />
        </div>
      </div>
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {t('transactions.filters.amountInvalid')}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onApply(undefined, undefined)
          }}
        >
          {t('transactions.filters.clear')}
        </Button>
        <Button type="submit">{t('transactions.filters.apply')}</Button>
      </div>
    </form>
  )
}
