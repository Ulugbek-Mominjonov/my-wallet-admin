import { Ban, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ENTITY_COLORS } from '@/shared/config/icons'
import { cn } from '@/shared/lib/utils'

/** Spravochnik rangi (`#RRGGBB`, katta harf) yoki rangsiz. */
export function ColorPicker({
  labelledBy,
  value,
  onChange,
}: {
  labelledBy: string
  value: string | null
  onChange: (value: string | null) => void
}) {
  const { t } = useTranslation()
  const swatch =
    'flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-label={t('directories.noColor')}
        aria-pressed={value === null}
        className={cn(swatch, 'border', value === null && 'ring-2 ring-foreground')}
        onClick={() => {
          onChange(null)
        }}
      >
        <Ban className="size-4 text-muted-foreground" aria-hidden />
      </button>
      {ENTITY_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={value === color}
          className={cn(swatch, value === color && 'ring-2 ring-foreground')}
          style={{ backgroundColor: color }}
          onClick={() => {
            onChange(color)
          }}
        >
          {value === color && <Check className="size-4 text-white" aria-hidden />}
        </button>
      ))}
    </div>
  )
}
