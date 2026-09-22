import type { UseFormRegisterReturn } from 'react-hook-form'

import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/**
 * Summa maydoni (matn: `1 500 000`, `,`/`.` kasr) — yorliq, xato yoki izoh
 * ekran o'quvchiga bog'langan. Qiymat sxemada `parseMoney` bilan o'qiladi.
 */
export function AmountField({
  id,
  label,
  hint,
  error,
  registration,
  disabled = false,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  registration: UseFormRegisterReturn
  disabled?: boolean
}) {
  const note = error ?? hint
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? `${id}-note` : undefined}
        {...registration}
        disabled={disabled}
      />
      {note && (
        <p
          id={`${id}-note`}
          className={error ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}
        >
          {note}
        </p>
      )}
    </div>
  )
}
