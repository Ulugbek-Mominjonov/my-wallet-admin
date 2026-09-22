import { cn } from '@/shared/lib/utils'

export type ProgressTone = 'income' | 'warning' | 'expense' | 'primary'

const TONE: Record<ProgressTone, string> = {
  income: 'bg-income',
  warning: 'bg-warning',
  expense: 'bg-expense',
  primary: 'bg-primary',
}

/**
 * Nisbat chizig'i (0..1, 1 dan oshsa to'liq) — ekran o'quvchiga foiz va
 * holat matni (`label`) bilan.
 */
export function ProgressBar({
  value,
  tone = 'primary',
  label,
  className,
}: {
  value: number
  tone?: ProgressTone
  /** `aria-valuetext` — masalan "85% — Yaqinlashdi". */
  label: string
  className?: string
}) {
  const percent = Math.max(0, Math.round(value * 100))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(percent, 100)}
      aria-valuetext={label}
      className={cn('h-2 overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full', TONE[tone])}
        style={{ width: `${String(Math.min(percent, 100))}%` }}
      />
    </div>
  )
}
