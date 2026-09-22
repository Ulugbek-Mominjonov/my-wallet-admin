import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ICON_GROUPS, type IconGroup } from '@/shared/config/icons'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { EntityIcon } from '@/shared/ui/entity-icon'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

/** Neytral ikon kaliti tanlagichi (contracts/api.md), guruhlangan. */
export function IconPicker({
  id,
  value,
  fallback,
  onChange,
}: {
  id?: string
  value: string | null
  /** Tanlanmagan bo'lsa ko'rsatiladigan kalit (masalan hisob turining ikoni). */
  fallback: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button id={id} variant="outline" size="icon" aria-label={t('directories.chooseIcon')} />
        }
      >
        <EntityIcon name={value ?? fallback} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        {(Object.entries(ICON_GROUPS) as [IconGroup, Record<string, unknown>][]).map(
          ([group, icons]) => (
            <div key={group} role="group" aria-labelledby={`icons-${group}`} className="space-y-1">
              <p id={`icons-${group}`} className="text-xs font-medium text-muted-foreground">
                {t(`directories.iconGroups.${group}`)}
              </p>
              <div className="grid grid-cols-8 gap-1">
                {Object.keys(icons).map((key) => {
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={key}
                      aria-pressed={value === key}
                      className={cn(value === key && 'bg-accent ring-2 ring-ring')}
                      onClick={() => {
                        onChange(key)
                        setOpen(false)
                      }}
                    >
                      <EntityIcon name={key} />
                    </Button>
                  )
                })}
              </div>
            </div>
          ),
        )}
      </PopoverContent>
    </Popover>
  )
}
