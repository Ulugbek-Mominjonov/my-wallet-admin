import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

export function NotFound() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <EmptyState
        icon={SearchX}
        title="Sahifa topilmadi"
        description="Havola eskirgan yoki noto'g'ri yozilgan bo'lishi mumkin."
        action={<Button render={<Link to="/" />}>Bosh sahifaga</Button>}
      />
    </div>
  )
}
