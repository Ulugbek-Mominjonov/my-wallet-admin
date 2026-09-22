import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Role } from '@/entities/household'
import { AppSidebar } from '@/features/app-shell/ui/app-sidebar'
import { CommandMenu } from '@/features/app-shell/ui/command-menu'
import { LanguageMenu } from '@/features/app-shell/ui/language-menu'
import { ThemeMenu } from '@/features/app-shell/ui/theme-menu'
import { Separator } from '@/shared/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar'

/**
 * Byudjet sahifalari karkasi: yig'iladigan sidebar (mobilda drawer) va topbar.
 * Menyu joriy byudjet va rolga moslanadi; byudjet almashtirgich — boshqa
 * feature, shuning uchun marshrut uni `switcher` sloti orqali beradi.
 * Profil menyusi (E21-T04) topbar'ga qo'shiladi.
 */
export function AppShell({
  householdId,
  role,
  switcher,
  children,
}: {
  householdId: string
  role: Role
  switcher: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <SidebarProvider>
      <AppSidebar householdId={householdId} role={role} header={switcher} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
          <SidebarTrigger aria-label={t('shell.toggleSidebar')} />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex flex-1 items-center justify-end gap-1">
            <CommandMenu householdId={householdId} role={role} />
            <LanguageMenu />
            <ThemeMenu />
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
