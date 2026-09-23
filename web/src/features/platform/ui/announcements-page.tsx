import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  ANNOUNCEMENT_CHANNELS,
  announcementLogQuery,
  platformKey,
  sendAnnouncement,
  usersQuery,
  type AnnouncementChannel,
} from '@/features/platform/api/platform-api'
import { Field } from '@/features/platform/ui/form-fields'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { FilterMultiSelect } from '@/shared/ui/filter-multi-select'
import { FormSelect } from '@/shared/ui/form-select'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page-header'
import { SectionCard } from '@/shared/ui/section-card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Textarea } from '@/shared/ui/textarea'

type Audience = 'all' | 'selected'

const EMPTY = { uz: '', ru: '', en: '' }

/**
 * E26-T03: e'lon — hamma yoki tanlangan foydalanuvchilarga. Yuborish
 * navbat orqali (notify-dispatch), shuning uchun natija "navbatga qo'yildi";
 * kanali o'chiq yoki qurilmasi yo'q foydalanuvchiga yozilmaydi (BR-163).
 */
export function PlatformAnnouncementsPage() {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState(EMPTY)
  const [audience, setAudience] = useState<Audience>('all')
  const [selected, setSelected] = useState<readonly string[]>([])
  const [channels, setChannels] = useState<readonly AnnouncementChannel[]>(['push', 'telegram'])
  const [confirming, setConfirming] = useState(false)

  const users = useQuery({ ...usersQuery('', 200), enabled: audience === 'selected' })
  const log = useQuery(announcementLogQuery)

  const send = useMutation({
    mutationFn: () =>
      sendAnnouncement({
        message,
        title: null,
        users: audience === 'all' ? null : selected,
        channels,
      }),
    onSuccess: async (result) => {
      setConfirming(false)
      setMessage(EMPTY)
      toast.success(t('platform.announcements.sent', { count: result.queued, users: result.users }))
      await queryClient.invalidateQueries({ queryKey: platformKey('announcements') })
    },
  })

  const ready =
    Object.values(message).every((text) => text.trim() !== '') &&
    channels.length > 0 &&
    (audience === 'all' || selected.length > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('platform.announcements.title')}
        description={t('platform.announcements.description')}
      />

      <SectionCard title={t('platform.announcements.new')}>
        <div className="grid max-w-2xl gap-4">
          {(['uz', 'ru', 'en'] as const).map((lang) => (
            <Field key={lang} id={`announcement-${lang}`} label={t(`platform.fields.name_${lang}`)}>
              <Textarea
                id={`announcement-${lang}`}
                rows={2}
                value={message[lang]}
                onChange={(event) => {
                  setMessage({ ...message, [lang]: event.target.value })
                }}
              />
            </Field>
          ))}

          <Field id="announcement-audience" label={t('platform.announcements.audience')} labelledBy>
            <FormSelect
              labelId="announcement-audience-label"
              value={audience}
              options={[
                { value: 'all', label: t('platform.announcements.all') },
                { value: 'selected', label: t('platform.announcements.selected') },
              ]}
              onChange={(value) => {
                setAudience(value as Audience)
              }}
            />
          </Field>

          {audience === 'selected' && (
            <FilterMultiSelect
              label={t('platform.announcements.users')}
              options={(users.data?.users ?? []).map((user) => ({
                value: user.user_id,
                label: user.email ?? user.display_name,
              }))}
              value={selected}
              onChange={setSelected}
            />
          )}

          <div className="grid gap-1.5">
            <Label id="announcement-channels-label">{t('platform.announcements.channels')}</Label>
            <FilterMultiSelect
              label={t('platform.announcements.channels')}
              options={ANNOUNCEMENT_CHANNELS.map((channel) => ({
                value: channel,
                label: t(`notifications.channel.${channel}`),
              }))}
              value={channels}
              onChange={(next) => {
                setChannels(next as AnnouncementChannel[])
              }}
            />
          </div>

          <div>
            <Button
              disabled={!ready || send.isPending}
              onClick={() => {
                setConfirming(true)
              }}
            >
              <Megaphone aria-hidden />
              {t('platform.announcements.send')}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={t('platform.announcements.log')}
        description={t('platform.announcements.logHint')}
      >
        {log.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (log.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">{t('platform.announcements.logEmpty')}</p>
        ) : (
          <Table aria-label={t('platform.announcements.log')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.announcements.at')}</TableHead>
                <TableHead>{t('platform.announcements.message')}</TableHead>
                <TableHead className="text-right">
                  {t('platform.announcements.usersCount')}
                </TableHead>
                <TableHead>{t('platform.announcements.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(log.data?.items ?? []).map((item) => (
                <TableRow key={item.batch}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(item.created_at, locale)}
                  </TableCell>
                  <TableCell className="max-w-96 truncate">{item.message ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.users}</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    <Badge>{t('platform.announcements.sentCount', { count: item.sent })}</Badge>
                    {item.pending > 0 && (
                      <Badge variant="outline">
                        {t('platform.announcements.pendingCount', { count: item.pending })}
                      </Badge>
                    )}
                    {item.failed > 0 && (
                      <Badge variant="destructive">
                        {t('platform.announcements.failedCount', { count: item.failed })}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('platform.announcements.confirmTitle')}
        description={
          audience === 'all'
            ? t('platform.announcements.confirmAll')
            : t('platform.announcements.confirmSelected', { count: selected.length })
        }
        confirmLabel={t('platform.announcements.send')}
        cancelLabel={t('common.cancel')}
        pending={send.isPending}
        onConfirm={() => {
          send.mutate()
        }}
      />
    </div>
  )
}
