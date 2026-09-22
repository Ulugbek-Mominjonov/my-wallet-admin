import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { LogOut, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { signOut } from '@/features/auth/api/auth-api'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

/** Topbar: kim kirgani, profil va chiqish (chiqqach — /login, watchAuthEvents). */
export function UserMenu({
  name,
  email,
  householdId,
}: {
  name: string
  email: string
  householdId: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const leave = useMutation({ mutationFn: () => signOut() })
  const initial = (name || email).trim().charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={t('account.menu')} />}
      >
        <Avatar size="sm">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid">
            {name && <span className="truncate text-sm text-foreground">{name}</span>}
            <span className="truncate">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void navigate({ to: '/h/$householdId/profile', params: { householdId } })
          }}
        >
          <UserRound aria-hidden />
          {t('account.profile')}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={leave.isPending}
          onClick={() => {
            leave.mutate()
          }}
        >
          <LogOut aria-hidden />
          {t('account.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
