import { Link, useMatchRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { Role } from '@/entities/household'
import { navSectionsFor } from '@/features/app-shell/navigation'
import {
  Sidebar,
  SidebarContent,
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
}: {
  householdId: string
  role: Role
  header: ReactNode
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
      <SidebarRail />
    </Sidebar>
  )
}
