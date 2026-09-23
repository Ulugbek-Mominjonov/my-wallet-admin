import { z } from 'zod'

/** Alohida boshqariladigan kalitlar — qolganlari "flaglar" ro'yxatida. */
export const KNOWN_KEYS = ['min_android_version', 'maintenance'] as const

/** BR-214: `X.Y.Z` (jadval CHECK'i bilan bir xil). */
export const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/)

/** Texnik ishlar banneri: uch tilda xabar va ixtiyoriy tugash vaqti. */
export const maintenanceSchema = z.object({
  message: z.object({ uz: z.string(), ru: z.string(), en: z.string() }),
  until: z.string().optional(),
})

export type Maintenance = z.infer<typeof maintenanceSchema>

export interface MaintenanceForm {
  enabled: boolean
  uz: string
  ru: string
  en: string
  /** `datetime-local` maydoni (bo'sh — muddatsiz). */
  until: string
}

/** Konfiguratsiya qiymati → forma qiymatlari (noto'g'ri qiymat — o'chiq banner). */
export function maintenanceToForm(value: unknown): MaintenanceForm {
  const parsed = maintenanceSchema.safeParse(value)
  if (!parsed.success) return { enabled: false, uz: '', ru: '', en: '', until: '' }
  const { message, until } = parsed.data
  return {
    enabled: true,
    uz: message.uz,
    ru: message.ru,
    en: message.en,
    // `2026-10-05T12:00:00Z` → `2026-10-05T12:00` (input qabul qiladigan ko'rinish).
    until: until === undefined ? '' : until.slice(0, 16),
  }
}

/** Forma → konfiguratsiya qiymati (o'chiq bo'lsa — `null`). */
export function maintenanceToValue(form: MaintenanceForm): Maintenance | null {
  if (!form.enabled) return null
  return {
    message: { uz: form.uz.trim(), ru: form.ru.trim(), en: form.en.trim() },
    ...(form.until === '' ? {} : { until: `${form.until}:00Z` }),
  }
}

/** Banner hozir ko'rinadimi (`until` o'tgan bo'lsa — yo'q; mobil ham shunday). */
export function isMaintenanceActive(value: unknown, now: Date): boolean {
  const parsed = maintenanceSchema.safeParse(value)
  if (!parsed.success) return false
  const { until } = parsed.data
  return until === undefined || new Date(until).getTime() > now.getTime()
}
