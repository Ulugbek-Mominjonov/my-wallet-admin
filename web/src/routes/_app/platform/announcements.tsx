import { createFileRoute } from '@tanstack/react-router'

import { PlatformAnnouncementsPage } from '@/features/platform'

/** E26-T03: e'lonlar (push/Telegram) va yuborish jurnali. */
export const Route = createFileRoute('/_app/platform/announcements')({
  component: PlatformAnnouncementsPage,
})
