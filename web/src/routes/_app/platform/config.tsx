import { createFileRoute } from '@tanstack/react-router'

import { PlatformConfigPage } from '@/features/platform'

/** E26-T02: ilova konfiguratsiyasi (BR-214, texnik ishlar, flaglar). */
export const Route = createFileRoute('/_app/platform/config')({
  component: PlatformConfigPage,
})
