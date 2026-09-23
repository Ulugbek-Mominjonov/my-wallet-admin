import { createFileRoute } from '@tanstack/react-router'

import { PlatformHealthPage } from '@/features/platform'

/** E26-T05: tizim salomatligi — chegaralar, rejali ishlar, navbat. */
export const Route = createFileRoute('/_app/platform/health')({
  component: PlatformHealthPage,
})
