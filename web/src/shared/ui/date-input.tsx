import { useId } from 'react'

import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** Filtr qatoridagi sana maydoni: yorlig'i yonida, bo'sh qiymat — filtrsiz. */
export function DateInput({
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
