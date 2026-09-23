import { useRef, useState } from 'react'

import { useElementWidth } from '@/shared/lib/use-element-width'
import { cn } from '@/shared/lib/utils'

export interface ChartSeries {
  key: string
  label: string
  /** CSS rang (token): `var(--chart-1)`. */
  color: string
}

export interface ChartPoint {
  key: string
  /** X o'qidagi qisqa yorliq (masalan "Sen"). */
  label: string
  /** Har qator qiymati (asosiy valyutada, eng kichik birlikda). */
  values: Record<string, number>
}

/** O'lchamlar (px): o'q yorliqlari uchun joy va ustun oralig'i. */
const PAD = { top: 8, right: 8, bottom: 22, left: 64 }
const GRID_LINES = 4
/** Ustunlar orasidagi fon oralig'i va yumaloq uchi. */
const BAR_GAP = 2
const BAR_RADIUS = 4
/** Ingichka ustun: oy kam bo'lsa ham kengayib ketmaydi (guruh markazda). */
const MAX_BAR_WIDTH = 28
const LINE_WIDTH = 2
const DOT_RADIUS = 4

/** O'q chegarasi — 1/2/5 × 10ⁿ ga yaxlitlanadi (yorliqlar butun bo'lsin). */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const rest = value / magnitude
  const step = rest <= 1 ? 1 : rest <= 2 ? 2 : rest <= 5 ? 5 : 10
  return step * magnitude
}

/**
 * Ustunli grafik (guruhlangan) va ixtiyoriy chiziq — bitta o'qda (hammasi
 * bir xil birlikda). Kenglik konteynerdan o'lchanadi; sichqoncha ostidagi
 * nuqta uchun qiymatlar oynasi chiqadi.
 */
export function ColumnChart({
  points,
  series,
  line,
  formatValue,
  formatTooltip,
  height = 220,
  className,
}: {
  points: readonly ChartPoint[]
  series: readonly ChartSeries[]
  /** Ustunlar ustidagi chiziq (masalan "orttirgan"). */
  line?: ChartSeries
  /** O'q yorlig'i — qisqa ko'rinish. */
  formatValue: (value: number) => string
  /** Oyna ichidagi to'liq qiymat. */
  formatTooltip: (value: number) => string
  height?: number
  className?: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const width = useElementWidth(container)
  const [active, setActive] = useState<number | null>(null)

  const plotWidth = Math.max(width - PAD.left - PAD.right, 0)
  const plotHeight = height - PAD.top - PAD.bottom
  const all = points.flatMap((point) => [
    ...series.map((s) => point.values[s.key] ?? 0),
    ...(line ? [point.values[line.key] ?? 0] : []),
  ])
  const max = niceMax(Math.max(...all, 0))
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight
  const bandWidth = points.length > 0 ? plotWidth / points.length : 0
  const barWidth = Math.min(
    Math.max((bandWidth - BAR_GAP * (series.length + 1)) / series.length, 1),
    MAX_BAR_WIDTH,
  )
  const groupWidth = series.length * barWidth + (series.length - 1) * BAR_GAP
  const bandCenter = (index: number) => PAD.left + bandWidth * (index + 0.5)
  /** Guruh band markazida: ustunlar soni va kengligidan qat'i nazar. */
  const barX = (index: number, seriesIndex: number) =>
    bandCenter(index) - groupWidth / 2 + seriesIndex * (barWidth + BAR_GAP)
  const activePoint = active === null ? undefined : points[active]

  return (
    <div ref={container} className={cn('relative', className)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={series.map((s) => s.label).join(', ')}
          onMouseLeave={() => {
            setActive(null)
          }}
        >
          {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
            const value = (max / GRID_LINES) * i
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(value)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {formatValue(value)}
                </text>
              </g>
            )
          })}

          {points.map((point, index) => (
            <text
              key={point.key}
              x={bandCenter(index)}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {point.label}
            </text>
          ))}

          {points.map((point, index) =>
            series.map((s, seriesIndex) => {
              const value = point.values[s.key] ?? 0
              const top = y(value)
              const barHeight = Math.max(PAD.top + plotHeight - top, value > 0 ? 1 : 0)
              return (
                <rect
                  key={`${point.key}:${s.key}`}
                  x={barX(index, seriesIndex)}
                  y={PAD.top + plotHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={Math.min(BAR_RADIUS, barWidth / 2)}
                  fill={s.color}
                  opacity={active === null || active === index ? 1 : 0.45}
                />
              )
            }),
          )}

          {line && (
            <>
              {points.length > 1 && (
                <polyline
                  fill="none"
                  stroke={line.color}
                  strokeWidth={LINE_WIDTH}
                  strokeLinejoin="round"
                  points={points
                    .map((point, index) => `${bandCenter(index)},${y(point.values[line.key] ?? 0)}`)
                    .join(' ')}
                />
              )}
              {points.map((point, index) => (
                <circle
                  key={`dot:${point.key}`}
                  cx={bandCenter(index)}
                  cy={y(point.values[line.key] ?? 0)}
                  r={DOT_RADIUS}
                  fill={line.color}
                  className="stroke-card"
                  strokeWidth={LINE_WIDTH}
                />
              ))}
            </>
          )}

          {active !== null && (
            <line
              x1={bandCenter(active)}
              x2={bandCenter(active)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              className="stroke-muted-foreground"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          {points.map((point, index) => (
            <rect
              key={`hit:${point.key}`}
              x={PAD.left + bandWidth * index}
              y={PAD.top}
              width={bandWidth}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => {
                setActive(index)
              }}
            />
          ))}
        </svg>
      )}

      {activePoint && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 min-w-36 rounded-md border bg-popover p-2 text-xs shadow-md"
          style={{
            left: Math.min(Math.max(bandCenter(active ?? 0) - 72, 0), Math.max(width - 144, 0)),
          }}
        >
          <p className="font-medium">{activePoint.label}</p>
          <ul className="mt-1 space-y-0.5">
            {[...series, ...(line ? [line] : [])].map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    aria-hidden
                    className="size-2 rounded-[2px]"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.label}
                </span>
                <span className="tabular-nums">
                  {formatTooltip(activePoint.values[s.key] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
