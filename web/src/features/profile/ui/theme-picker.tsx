import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'

import { THEME_ICON, THEMES } from '@/shared/config/preferences'
import { Button } from '@/shared/ui/button'

/** Mavzu — shu brauzerda (next-themes); topbar menyusi bilan bir manba. */
export function ThemePicker() {
  const { t } = useTranslation()
  const { theme = 'system', setTheme } = useTheme()

  return (
    <div role="group" aria-label={t('shell.theme.label')} className="flex flex-wrap gap-2">
      {THEMES.map((value) => {
        const Icon = THEME_ICON[value]
        return (
          <Button
            key={value}
            variant={theme === value ? 'default' : 'outline'}
            aria-pressed={theme === value}
            onClick={() => {
              setTheme(value)
            }}
          >
            <Icon aria-hidden />
            {t(`shell.theme.${value}`)}
          </Button>
        )
      })}
    </div>
  )
}
