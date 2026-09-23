import type { ReactNode } from 'react'

import { Label } from '@/shared/ui/label'

/** Spravochnik formalaridagi maydon: yorliq, boshqaruv va xato matni. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  labelledBy = false,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
  /** Base UI Select uchun — `htmlFor` ishlamaydi, `labelId` beriladi. */
  labelledBy?: boolean
}) {
  return (
    <div className="grid gap-1.5">
      {labelledBy ? <Label id={`${id}-label`}>{label}</Label> : <Label htmlFor={id}>{label}</Label>}
      {children}
      {hint !== undefined && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
