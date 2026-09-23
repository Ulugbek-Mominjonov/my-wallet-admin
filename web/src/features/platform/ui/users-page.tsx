import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  platformKey,
  setBlocked,
  usersQuery,
  type PlatformUser,
} from '@/features/platform/api/platform-api'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { Input } from '@/shared/ui/input'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/**
 * E26-T04: qo'llab-quvvatlash ro'yxati — kim, qachon ro'yxatdan o'tgan,
 * oxirgi kirish, nechta byudjetda. Byudjet ichidagi ma'lumot ko'rinmaydi
 * (RLS): faqat agregat va bloklash.
 */
export function PlatformUsersPage() {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState<PlatformUser | null>(null)
  const users = useQuery(usersQuery(query))

  const block = useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      setBlocked(userId, blocked),
    onSuccess: async (_result, { blocked }) => {
      setConfirming(null)
      toast.success(blocked ? t('platform.users.blocked') : t('platform.users.unblocked'))
      await queryClient.invalidateQueries({ queryKey: platformKey('users') })
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader title={t('platform.users.title')} description={t('platform.users.description')} />

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setQuery(text.trim())
        }}
      >
        <Input
          className="w-72"
          aria-label={t('platform.users.search')}
          placeholder={t('platform.users.search')}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
          }}
        />
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          {t('platform.users.find')}
        </Button>
      </form>

      {users.isPending ? (
        <TableSkeleton />
      ) : users.error ? (
        <QueryError
          error={users.error}
          onRetry={() => {
            void users.refetch()
          }}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('platform.users.total', { count: users.data.total })}
          </p>
          <Table aria-label={t('platform.users.title')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.users.email')}</TableHead>
                <TableHead>{t('platform.users.name')}</TableHead>
                <TableHead>{t('platform.users.registered')}</TableHead>
                <TableHead>{t('platform.users.lastSignIn')}</TableHead>
                <TableHead className="text-right">{t('platform.users.households')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium">
                    {user.email ?? '—'}
                    {user.is_admin && (
                      <Badge variant="secondary" className="ml-2">
                        {t('platform.users.admin')}
                      </Badge>
                    )}
                    {user.blocked && (
                      <Badge variant="destructive" className="ml-2">
                        {t('platform.users.blockedBadge')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{user.display_name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(user.created_at, locale)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {user.last_sign_in_at === null
                      ? '—'
                      : formatDateTime(user.last_sign_in_at, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{user.households}</TableCell>
                  <TableCell className="text-right">
                    {!user.is_admin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConfirming(user)
                        }}
                      >
                        {user.blocked ? t('platform.users.unblock') : t('platform.users.block')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {users.data.total > users.data.users.length && (
            <p className="text-sm text-muted-foreground">
              {t('platform.users.narrow', { count: users.data.users.length })}
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
        title={
          confirming?.blocked
            ? t('platform.users.unblockTitle', { email: confirming.email ?? '' })
            : t('platform.users.blockTitle', { email: confirming?.email ?? '' })
        }
        description={
          confirming?.blocked ? t('platform.users.unblockText') : t('platform.users.blockText')
        }
        confirmLabel={confirming?.blocked ? t('platform.users.unblock') : t('platform.users.block')}
        cancelLabel={t('common.cancel')}
        destructive={confirming?.blocked !== true}
        pending={block.isPending}
        onConfirm={() => {
          if (confirming) {
            block.mutate({ userId: confirming.user_id, blocked: !confirming.blocked })
          }
        }}
      />
    </div>
  )
}
