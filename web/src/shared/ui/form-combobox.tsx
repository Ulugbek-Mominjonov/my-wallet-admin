import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'
import type { FilterOption } from '@/shared/ui/filter-multi-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

/**
 * Forma ichidagi qidiruvli tanlov (uzun ro'yxat — kategoriyalar). Yorliq
 * `labelId` orqali, xato holati ekran o'quvchiga bog'lanadi (FormSelect kabi).
 */
export function FormCombobox({
  labelId,
  value,
  options,
  onChange,
  placeholder,
  invalid = false,
  describedBy,
}: {
  labelId: string
  value: string
  options: readonly FilterOption[]
  onChange: (value: string) => void
  placeholder: string
  invalid?: boolean
  describedBy?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-labelledby={labelId}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={describedBy}
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown aria-hidden className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-64 p-0">
        <Command>
          <CommandInput placeholder={t('table.search')} aria-label={t('table.search')} />
          <CommandList>
            <CommandEmpty>{t('table.noResults')}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  data-checked={option.value === value}
                  aria-checked={option.value === value}
                  className={cn(option.depth === 1 && 'pl-6')}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
