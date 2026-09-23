import { Link, useMatchRoute } from '@tanstack/react-router'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PLATFORM_NAV } from '@/features/platform/model/navigation'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/shared/ui/sidebar'

/**
 * E26: platforma bo'limi karkasi — byudjet menyusidan alohida (bu yerda
 * byudjet konteksti yo'q). Tepada byudjetga qaytish havolasi.
 */
export function PlatformShell({
  householdId,
  userMenu,
  children,
}: {
  /** Qaytish uchun oxirgi byudjet (bo'lmasa — bosh sahifa). */
  householdId: string | null
  userMenu: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
            <ShieldCheck aria-hidden className="size-4 text-primary" />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              {t('platform.title')}
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t('platform.title')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {PLATFORM_NAV.map((item) => {
                  const label = t(item.labelKey)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={Boolean(matchRoute({ to: item.to, fuzzy: !item.exact }))}
                        tooltip={label}
                        render={<Link to={item.to} />}
                      >
                        <item.icon aria-hidden />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-4">
          <SidebarTrigger aria-label={t('shell.toggleSidebar')} />
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Button
            variant="ghost"
            size="sm"
            render={
              householdId === null ? (
                <Link to="/" />
              ) : (
                <Link to="/h/$householdId" params={{ householdId }} />
              )
            }
          >
            <ArrowLeft aria-hidden />
            {t('platform.back')}
          </Button>
          <div className="flex flex-1 items-center justify-end gap-1">{userMenu}</div>
        </header>
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
