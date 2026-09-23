import { createFileRoute } from '@tanstack/react-router'

import { PlatformDirectoriesPage } from '@/features/platform'

/** E26-T01: tizim spravochniklari (valyuta, kategoriya va karta shablonlari). */
export const Route = createFileRoute('/_app/platform/')({
  component: PlatformDirectoriesPage,
})
