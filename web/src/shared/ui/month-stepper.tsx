import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppLocale } from '@/shared/i18n'
import { formatMonth, shiftMonth, type MonthKey } from '@/shared/lib/month'
import { Button } from '@/shared/ui/button'

/** Oyni oldinga/orqaga surish; joriy oydan boshqasida — "Joriy oy" tugmasi. */
export function MonthStepper({
  value,
  current,
  onChange,
}: {
  value: MonthKey
  current: MonthKey
  onChange: (month: MonthKey) => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label={t('common.prevMonth')}
        onClick={() => {
          onChange(shiftMonth(value, -1))
        }}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <span aria-live="polite" className="min-w-36 text-center text-sm font-medium">
        {formatMonth(value, locale)}
      </span>
      <Button
        variant="outline"
        size="icon"
        aria-label={t('common.nextMonth')}
        onClick={() => {
          onChange(shiftMonth(value, 1))
        }}
      >
        <ChevronRight aria-hidden />
      </Button>
      {value !== current && (
        <Button
          variant="ghost"
          onClick={() => {
            onChange(current)
          }}
        >
          {t('common.currentMonth')}
        </Button>
      )}
    </div>
  )
}
