import { ListFilter } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

export interface FilterOption {
  value: string
  label: string
  /** 1 — subkategoriya kabi ichki qator (chekinish bilan). */
  depth?: 0 | 1
}

/**
 * Jadval filtri: bir nechta qiymat tanlash (qidiruvli ro'yxat). Tugmada
 * tanlanganlar soni; tanlov darhol qo'llanadi.
 */
export function FilterMultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly FilterOption[]
  value: readonly string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation()
  const selected = new Set(value)
  const toggle = (id: string) => {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" className={cn(value.length === 0 && 'border-dashed')} />}
      >
        <ListFilter aria-hidden />
        {label}
        {value.length > 0 && (
          <Badge variant="secondary" aria-label={t('table.selectedCount', { count: value.length })}>
            {value.length}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={label} aria-label={t('table.filterSearch', { name: label })} />
          <CommandList>
            <CommandEmpty>{t('table.noResults')}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  data-checked={selected.has(option.value)}
                  aria-checked={selected.has(option.value)}
                  className={cn(option.depth === 1 && 'pl-6')}
                  onSelect={() => {
                    toggle(option.value)
                  }}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {value.length > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  onChange([])
                }}
              >
                {t('table.clearFilter')}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
