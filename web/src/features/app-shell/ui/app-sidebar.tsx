import { Link, useMatchRoute } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Role } from '@/entities/household'
import { navSectionsFor } from '@/features/app-shell/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/shared/ui/sidebar'

export function AppSidebar({
  householdId,
  role,
  header,
  platformAdmin = false,
}: {
  householdId: string
  role: Role
  header: ReactNode
  /** BR-213: super-admin bo'limiga havola (faqat platforma adminida). */
  platformAdmin?: boolean
}) {
  const { t } = useTranslation()
  const matchRoute = useMatchRoute()
  const params = { householdId }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>{header}</SidebarHeader>
      <SidebarContent>
        {navSectionsFor(role).map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel>{t(section.titleKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const label = t(item.labelKey)
                  const isActive = Boolean(matchRoute({ to: item.to, params, fuzzy: !item.exact }))
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={label}
                        render={<Link to={item.to} params={params} />}
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
        ))}
      </SidebarContent>
      {platformAdmin && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={t('nav.platform')} render={<Link to="/platform" />}>
                <ShieldCheck aria-hidden />
                <span>{t('nav.platform')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
