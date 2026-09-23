import { useMemo } from 'react'
import { encode } from 'uqr'

/** Modul atrofidagi bo'sh joy (QR standarti — 4 modul). */
const QUIET_ZONE = 4

/**
 * Havolani QR sifatida ko'rsatadi: telefon kamerasi bilan ochish uchun.
 * Bitta `<path>` — har modul uchun alohida element emas.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  const { size, path } = useMemo(() => {
    const { size: modules, data } = encode(value)
    const parts: string[] = []
    for (const [y, row] of data.entries()) {
      for (const [x, dark] of row.entries()) {
        if (dark) parts.push(`M${String(x + QUIET_ZONE)} ${String(y + QUIET_ZONE)}h1v1h-1z`)
      }
    }
    return { size: modules + QUIET_ZONE * 2, path: parts.join('') }
  }, [value])

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
