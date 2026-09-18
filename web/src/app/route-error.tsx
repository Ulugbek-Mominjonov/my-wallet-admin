import type { ErrorComponentProps } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

/** Marshrut ichidagi kutilmagan xato: foydalanuvchiga tushunarli matn, qayta urinish. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="mx-auto max-w-lg p-6">
      <EmptyState
        icon={TriangleAlert}
        title="Nimadir xato ketdi"
        description={message}
        action={<Button onClick={reset}>Qayta urinish</Button>}
      />
    </div>
  )
}
