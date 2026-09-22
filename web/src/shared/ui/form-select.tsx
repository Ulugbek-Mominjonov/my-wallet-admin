import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

export interface SelectOption {
  value: string
  label: string
}

/**
 * Forma ichidagi tanlov: yorliq `labelId` orqali (Base UI Select'da
 * `htmlFor` ishlamaydi), xato holati va izoh ekran o'quvchiga bog'lanadi.
 */
export function FormSelect({
  labelId,
  value,
  options,
  onChange,
  disabled = false,
  invalid = false,
  describedBy,
}: {
  labelId: string
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      items={options}
      onValueChange={(next: string | null) => {
        onChange(next ?? '')
      }}
    >
      <SelectTrigger
        className="w-full"
        aria-labelledby={labelId}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
