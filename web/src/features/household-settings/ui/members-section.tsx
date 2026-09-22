import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Copy, Crown, LogOut, UserMinus, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ROLES, type Role } from '@/entities/household'
import {
  createInvite,
  invitesQuery,
  leaveHousehold,
  membersKey,
  membersQuery,
  removeMember,
  setMemberRole,
  transferOwnership,
  type Invite,
  type Member,
} from '@/features/household-settings/api/settings-api'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { FormSelect } from '@/shared/ui/form-select'
import { Label } from '@/shared/ui/label'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Skeleton } from '@/shared/ui/skeleton'

/** Taklif va rol o'zgartirishda berilishi mumkin bo'lgan rollar (owner — faqat o'tkazish). */
const ASSIGNABLE: readonly Role[] = ROLES.filter((role) => role !== 'owner')

type Pending =
  | { kind: 'remove'; member: Member }
  | { kind: 'transfer'; member: Member }
  | { kind: 'leave' }
  | null

/**
 * E22-T07: a'zolar (BR-011..014) — rollar, taklif (kod, 7 kun), chiqarish,
 * egalikni o'tkazish, o'zi chiqish. Chegaralar serverda (oxirgi owner,
 * admin owner'ga tegmaydi); UI faqat mumkin bo'lganini ko'rsatadi.
 */
export function MembersSection({
  householdId,
  userId,
  role,
}: {
  householdId: string
  userId: string
  role: Role
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = role === 'owner' || role === 'admin'
  const members = useQuery(membersQuery(householdId))
  const invites = useQuery({ ...invitesQuery(householdId), enabled: canManage })
  const [inviteRole, setInviteRole] = useState<Role>('member')
  const [created, setCreated] = useState<Invite | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: membersKey(householdId) })
  const invite = useMutation({
    mutationFn: () => createInvite(householdId, inviteRole),
    onSuccess: async (result) => {
      setCreated(result)
      await refresh()
    },
  })
  const changeRole = useMutation({
    mutationFn: ({ member, next }: { member: Member; next: Role }) =>
      setMemberRole(householdId, member.userId, next),
    onSuccess: () => toast.success(t('settings.members.roleChanged')),
    onSettled: refresh,
  })
  const act = useMutation({
    mutationFn: async (action: NonNullable<Pending>) => {
      if (action.kind === 'remove') await removeMember(householdId, action.member.userId)
      if (action.kind === 'transfer') await transferOwnership(householdId, action.member.userId)
      if (action.kind === 'leave') await leaveHousehold(householdId)
    },
    onSuccess: async (_, action) => {
      setPending(null)
      if (action.kind === 'leave') {
        toast.success(t('settings.members.left'))
        await queryClient.invalidateQueries({ queryKey: qk.bootstrap() })
        await navigate({ to: '/' })
        return
      }
      toast.success(
        action.kind === 'remove'
          ? t('settings.members.removed')
          : t('settings.members.transferred'),
      )
      // Egalik o'tsa o'z rolimiz ham o'zgaradi (admin) — kontekst yangilanadi.
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: qk.bootstrap() })])
    },
    onError: () => {
      setPending(null)
    },
  })

  const roleLabel = (value: Role) => t(`household.roles.${value}`)
  const roleOptions = ASSIGNABLE.map((value) => ({ value, label: roleLabel(value) }))
  const nameOf = (member: Member) => member.name || t('settings.members.unnamed')

  return (
    <SectionCard title={t('settings.members.title')}>
      {members.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : members.isError ? (
        <QueryError
          error={members.error}
          onRetry={() => {
            void members.refetch()
          }}
        />
      ) : (
        <ul className="divide-y">
          {members.data.map((member) => {
            const self = member.userId === userId
            // Admin owner'ga tegolmaydi; o'zini chiqarish — "chiqish" orqali.
            const editable = canManage && !self && member.role !== 'owner'
            return (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-40 flex-1">
                  <p className="font-medium">
                    {nameOf(member)}{' '}
                    {self && (
                      <span className="text-sm text-muted-foreground">
                        ({t('settings.members.you')})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.members.joined')}: {formatDateTime(member.joinedAt, locale)}
                  </p>
                </div>
                {editable ? (
                  <div className="w-40">
                    <span id={`role-${member.userId}`} className="sr-only">
                      {t('settings.members.changeRole', { name: nameOf(member) })}
                    </span>
                    <FormSelect
                      labelId={`role-${member.userId}`}
                      value={member.role}
                      options={roleOptions}
                      onChange={(next) => {
                        changeRole.mutate({ member, next: next as Role })
                      }}
                    />
                  </div>
                ) : (
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {roleLabel(member.role)}
                  </Badge>
                )}
                <div className="flex gap-1">
                  {role === 'owner' && !self && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${t('settings.members.transfer')}: ${nameOf(member)}`}
                      onClick={() => {
                        setPending({ kind: 'transfer', member })
                      }}
                    >
                      <Crown aria-hidden />
                    </Button>
                  )}
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${t('settings.members.remove')}: ${nameOf(member)}`}
                      onClick={() => {
                        setPending({ kind: 'remove', member })
                      }}
                    >
                      <UserMinus aria-hidden />
                    </Button>
                  )}
                  {self && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPending({ kind: 'leave' })
                      }}
                    >
                      <LogOut aria-hidden />
                      {t('settings.members.leave')}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canManage && (
        <div className="mt-4 grid gap-3 border-t pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid w-44 gap-1.5">
              <Label id="invite-role-label">{t('settings.members.inviteRole')}</Label>
              <FormSelect
                labelId="invite-role-label"
                value={inviteRole}
                options={roleOptions}
                onChange={(value) => {
                  setInviteRole(value as Role)
                }}
              />
            </div>
            <Button
              disabled={invite.isPending}
              onClick={() => {
                invite.mutate()
              }}
            >
              <UserPlus aria-hidden />
              {t('settings.members.invite')}
            </Button>
          </div>
          {invites.data && invites.data.length > 0 && (
            <div className="grid gap-1 text-sm">
              <p className="font-medium">{t('settings.members.activeInvites')}</p>
              <ul className="grid gap-1">
                {invites.data.map((item) => (
                  <li key={item.code} className="flex flex-wrap items-center gap-2">
                    <code className="rounded bg-muted px-2 py-0.5 font-mono tracking-widest">
                      {item.code}
                    </code>
                    <Badge variant="outline">{roleLabel(item.role)}</Badge>
                    <span className="text-muted-foreground">
                      {t('settings.members.expires', {
                        date: formatDateTime(item.expiresAt, locale),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <InviteCreatedDialog
        invite={created}
        onClose={() => {
          setCreated(null)
        }}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
        title={
          pending?.kind === 'remove'
            ? t('settings.members.removeTitle', { name: nameOf(pending.member) })
            : pending?.kind === 'transfer'
              ? t('settings.members.transferTitle', { name: nameOf(pending.member) })
              : t('settings.members.leaveTitle')
        }
        description={
          pending?.kind === 'remove'
            ? t('settings.members.removeText')
            : pending?.kind === 'transfer'
              ? t('settings.members.transferText')
              : t('settings.members.leaveText')
        }
        confirmLabel={
          pending?.kind === 'remove'
            ? t('settings.members.remove')
            : pending?.kind === 'transfer'
              ? t('settings.members.transfer')
              : t('settings.members.leave')
        }
        cancelLabel={t('common.cancel')}
        destructive={pending?.kind !== 'transfer'}
        pending={act.isPending}
        onConfirm={() => {
          if (pending) act.mutate(pending)
        }}
      />
    </SectionCard>
  )
}

/** Yaratilgan taklif kodi — nusxa olish bilan (BR-012: 7 kun, bir martalik). */
function InviteCreatedDialog({ invite, onClose }: { invite: Invite | null; onClose: () => void }) {
  const { t } = useTranslation()
  const copy = useMutation({
    mutationFn: (code: string) => navigator.clipboard.writeText(code),
    onSuccess: () => toast.success(t('settings.members.copied')),
  })
  return (
    <Dialog
      open={invite !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('settings.members.inviteTitle')}</DialogTitle>
          <DialogDescription>{t('settings.members.inviteText')}</DialogDescription>
        </DialogHeader>
        <p className="text-center font-mono text-3xl font-semibold tracking-[0.3em]">
          {invite?.code}
        </p>
        {copy.error && (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(copy.error).message}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (invite) copy.mutate(invite.code)
            }}
          >
            <Copy aria-hidden />
            {t('settings.members.copy')}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
