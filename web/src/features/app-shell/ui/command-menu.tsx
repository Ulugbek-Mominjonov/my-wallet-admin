import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Role } from '@/entities/household'
import { navSectionsFor } from '@/features/app-shell/navigation'
import { LOCALE_KEYWORDS, LOCALE_NAMES, THEME_ICON, THEMES } from '@/shared/config/preferences'
import { APP_LOCALES } from '@/shared/config/locale'
import { setLocale } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'

/** ⌘K / Ctrl+K — sahifalarga o'tish va sozlamalar klaviaturadan. */
export function CommandMenu({ householdId, role }: { householdId: string; role: Role }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-9 justify-start gap-2 px-2 text-muted-foreground sm:w-56"
        onClick={() => {
          setOpen(true)
        }}
        aria-label={t('shell.command.open')}
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">{t('shell.command.open')}</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t('shell.command.title')}
        description={t('shell.command.placeholder')}
      >
        <Command>
          <CommandInput placeholder={t('shell.command.placeholder')} />
          <CommandList>
            <CommandEmpty>{t('shell.command.empty')}</CommandEmpty>
            {navSectionsFor(role).map((section) => (
              <CommandGroup key={section.id} heading={t(section.titleKey)}>
                {section.items.map((item) => (
                  <CommandItem
                    key={item.to}
                    onSelect={() => {
                      run(() => void navigate({ to: item.to, params: { householdId } }))
                    }}
                  >
                    <item.icon aria-hidden />
                    {t(item.labelKey)}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandGroup heading={t('shell.theme.label')}>
              {THEMES.map((value) => {
                const Icon = THEME_ICON[value]
                return (
                  <CommandItem
                    key={value}
                    onSelect={() => {
                      run(() => {
                        setTheme(value)
                      })
                    }}
                  >
                    <Icon aria-hidden />
                    {t(`shell.theme.${value}`)}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandGroup heading={t('shell.language')}>
              {APP_LOCALES.map((value) => (
                <CommandItem
                  key={value}
                  keywords={LOCALE_KEYWORDS[value]}
                  onSelect={() => {
                    run(() => {
                      setLocale(value)
                    })
                  }}
                >
                  {LOCALE_NAMES[value]}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
