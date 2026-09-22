import { useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown, Plus, WalletMinimal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { HouseholdSummary } from '@/entities/household'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/shared/ui/sidebar'

/**
 * E21-T02: sidebar sarlavhasidagi byudjet almashtirgich. Tanlangan byudjet
 * bosh sahifasi ochiladi (ichki sahifa ID lari boshqa byudjetda yo'q).
 */
export function HouseholdSwitcher({
  households,
  current,
}: {
  households: readonly HouseholdSummary[]
  current: HouseholdSummary
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <WalletMinimal className="size-4" aria-hidden />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{current.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {t(`household.roles.${current.role}`)}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('household.switch')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={current.id}
                onValueChange={(householdId: string) => {
                  void navigate({ to: '/h/$householdId', params: { householdId } })
                }}
              >
                {households.map((household) => (
                  <DropdownMenuRadioItem key={household.id} value={household.id} closeOnClick>
                    <span className="flex-1 truncate">{household.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`household.roles.${household.role}`)}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void navigate({ to: '/welcome' })
              }}
            >
              <Plus aria-hidden />
              {t('household.add')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
