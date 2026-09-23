import { createFileRoute } from '@tanstack/react-router'

import { PlatformRatesPage } from '@/features/platform'

/** E29-T04: valyuta kurslari — CBU tarixi va qo'lda tuzatish. */
export const Route = createFileRoute('/_app/platform/rates')({
  component: PlatformRatesPage,
})
