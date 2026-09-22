import { Skeleton } from '@/shared/ui/skeleton'

/** Jadval yuklanmoqda — qidiruv qatori va satrlar shakli. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <Skeleton className="h-9 w-full sm:w-64" />
      <div className="space-y-2 rounded-lg border p-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    </div>
  )
}
