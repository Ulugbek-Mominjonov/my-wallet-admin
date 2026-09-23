import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

/** Sozlamalar/profil bo'limi: sarlavha (h2), izoh, ixtiyoriy amal va tarkib. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string
  description?: string
  /** O'ng tomondagi amal (masalan "Hammasi" havolasi). */
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>
              <h2>{title}</h2>
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
