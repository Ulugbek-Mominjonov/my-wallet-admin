import { ChartColumn, Table2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/button'

/**
 * Grafik konteyneri: sarlavha, izoh va jadval ko'rinishiga almashtirish.
 * Jadval — grafikning ekran o'quvchi va bosib chiqarish uchun nusxasi
 * (rang yagona belgi bo'lib qolmaydi).
 */
export function ChartFigure({
  title,
  description,
  legend,
  table,
  children,
}: {
  title: string
  description?: string
  /** Ikki va undan ko'p qator bo'lsa — doim ko'rsatiladi. */
  legend?: ReactNode
  /**
   * Grafikdagi qiymatlarning jadval ko'rinishi — almashtirish tugmasi bilan.
   * Sahifada jadval doim ko'rinib tursa berilmaydi (takrorlanmasin).
   */
  table?: ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  const id = useId()
  const [asTable, setAsTable] = useState(false)

  return (
    <figure aria-labelledby={`${id}-title`} className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <figcaption id={`${id}-title`} className="font-medium">
            {title}
          </figcaption>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {legend}
          {table && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={asTable}
              onClick={() => {
                setAsTable((value) => !value)
              }}
            >
              {asTable ? <ChartColumn aria-hidden /> : <Table2 aria-hidden />}
              {asTable ? t('chart.asChart') : t('chart.asTable')}
            </Button>
          )}
        </div>
      </div>
      {asTable && table ? table : children}
    </figure>
  )
}

/** Qatorlar ro'yxati: rangli belgi + nom (rang yolg'iz belgilovchi emas). */
export function ChartLegend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
