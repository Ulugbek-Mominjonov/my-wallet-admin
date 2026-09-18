import type { AppLocale } from '@/shared/config/locale'
import { formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'

type MoneyTone = 'neutral' | 'auto' | 'income' | 'expense'

interface MoneyTextProps {
  /** Eng kichik birlikdagi summa (tiyin/sent). */
  amount: number
  currency?: string
  locale?: AppLocale
  /** `auto` — manfiy qizil, musbat yashil (qoldiq uchun). */
  tone?: MoneyTone
  signed?: boolean
  className?: string
}

const toneClass = (tone: MoneyTone, amount: number): string => {
  if (tone === 'income') return 'text-income'
  if (tone === 'expense') return 'text-expense'
  if (tone === 'auto' && amount < 0) return 'text-expense'
  if (tone === 'auto' && amount > 0) return 'text-income'
  return ''
}

/** Summani bir xil ko'rinishda chiqaradi: tabular raqamlar, qatorga bo'linmaydi. */
export function MoneyText({
  amount,
  currency,
  locale,
  tone = 'neutral',
  signed,
  className,
}: MoneyTextProps) {
  return (
    <span className={cn('whitespace-nowrap tabular-nums', toneClass(tone, amount), className)}>
      {formatMoney(amount, { currency, locale, signed })}
    </span>
  )
}
