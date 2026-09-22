import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LOCALE_NAMES } from '@/shared/config/preferences'
import { APP_LOCALES, type AppLocale } from '@/shared/config/locale'
import { setLocale, useAppLocale } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

export function LanguageMenu() {
  const { t } = useTranslation()
  const locale = useAppLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={t('shell.language')} />}
      >
        <Languages className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value: AppLocale) => {
            setLocale(value)
          }}
        >
          {APP_LOCALES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {LOCALE_NAMES[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
