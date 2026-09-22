import { Eye } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { roleCan, type Role } from '@/entities/household'
import { AppSidebar } from '@/features/app-shell/ui/app-sidebar'
import { CommandMenu } from '@/features/app-shell/ui/command-menu'
import { LanguageMenu } from '@/features/app-shell/ui/language-menu'
import { ThemeMenu } from '@/features/app-shell/ui/theme-menu'
import { Badge } from '@/shared/ui/badge'
import { Separator } from '@/shared/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/ui/sidebar'

/**
 * Byudjet sahifalari karkasi: yig'iladigan sidebar (mobilda drawer) va topbar.
 * Menyu joriy byudjet va rolga moslanadi; byudjet almashtirgich va hisob
 * menyusi — boshqa feature'lar, shuning uchun marshrut ularni slot orqali beradi.
 */
export function AppShell({
  householdId,
  role,
  switcher,
  userMenu,
  children,
}: {
  householdId: string
  role: Role
  switcher: ReactNode
  userMenu: ReactNode
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
          {!roleCan(role, 'write') && (
            // E21-T03: viewer — faqat o'qish; sahifalar tugmalarni useCan bilan o'chiradi.
            <Badge variant="secondary" title={t('household.readOnlyHint')}>
              <Eye aria-hidden />
              {t('household.readOnly')}
            </Badge>
          )}
          <div className="flex flex-1 items-center justify-end gap-1">
            <CommandMenu householdId={householdId} role={role} />
            <LanguageMenu />
            <ThemeMenu />
            {userMenu}
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
