import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2Off } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  prefsKey,
  telegramKey,
  telegramLinkToken,
  telegramQuery,
  telegramUnlink,
} from '@/features/notifications/api/notifications-api'
import { env } from '@/shared/config/env'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { QrCode } from '@/shared/ui/qr-code'
import { SectionCard } from '@/shared/ui/section-card'

/** BR-163: har foydalanuvchi o'z Telegram'ini bir martalik havola bilan ulaydi. */
export function TelegramSection({ householdId }: { householdId: string }) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const link = useQuery(telegramQuery)
  const [url, setUrl] = useState<string | null>(null)

  const start = useMutation({
    mutationFn: telegramLinkToken,
    onSuccess: ({ token }) => {
      setUrl(`https://t.me/${env.VITE_TELEGRAM_BOT}?start=${token}`)
    },
  })
  const unlink = useMutation({
    mutationFn: telegramUnlink,
    onSuccess: async () => {
      setUrl(null)
      toast.success(t('notifications.telegram.unlinked'))
      // Kanal sozlamasi ham o'chadi (server yuborolmaydi) — qayta so'raladi.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: telegramKey }),
        queryClient.invalidateQueries({ queryKey: prefsKey(householdId) }),
      ])
    },
  })

  if (env.VITE_TELEGRAM_BOT === '') {
    return (
      <SectionCard title={t('notifications.telegram.title')}>
        <p className="text-sm text-muted-foreground">{t('notifications.telegram.notConfigured')}</p>
      </SectionCard>
    )
  }

  const linked = link.data ?? null

  return (
    <SectionCard
      title={t('notifications.telegram.title')}
      description={t('notifications.telegram.description')}
    >
      {linked ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{t('notifications.telegram.linked')}</Badge>
          <span className="text-sm text-muted-foreground">
            {formatDateTime(linked.linkedAt, locale)}
          </span>
          <Button
            variant="outline"
            disabled={unlink.isPending}
            onClick={() => {
              unlink.mutate()
            }}
          >
            <Link2Off aria-hidden />
            {t('notifications.telegram.unlink')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            disabled={start.isPending || link.isPending}
            onClick={() => {
              start.mutate()
            }}
          >
            {t('notifications.telegram.link')}
          </Button>
          {url !== null && (
            <div className="flex flex-wrap items-start gap-4">
              <QrCode value={url} label={t('notifications.telegram.qrAlt')} className="size-40" />
              <div className="space-y-2">
                <p className="text-sm">{t('notifications.telegram.linkHint')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    className="text-sm text-primary underline underline-offset-4"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {url}
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(url).then(
                        () => toast.success(t('notifications.telegram.copied')),
                        () => toast.error(t('errors.unknown')),
                      )
                    }}
                  >
                    <Copy aria-hidden />
                    {t('notifications.telegram.copy')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
