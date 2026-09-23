import { createFileRoute } from '@tanstack/react-router'

import { PlatformUsersPage } from '@/features/platform'

/** E26-T04: foydalanuvchilar (qo'llab-quvvatlash uchun agregat). */
export const Route = createFileRoute('/_app/platform/users')({
  component: PlatformUsersPage,
})
