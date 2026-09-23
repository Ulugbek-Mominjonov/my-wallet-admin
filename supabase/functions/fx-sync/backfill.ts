// E29-T01 (BR-192): kurslarni orqaga to'ldirish — kursordan eski ish
// kunlari uchun CBU'dan so'rab, `fx_upsert` ga beriladi.
//
// Bir chaqiruvda cheklangan paket olinadi (vaqt budjeti ham bor): qolgani
// keyingi kunlik ishda davom etadi. Kursor faqat muvaffaqiyatli olingan
// sanagacha suriladi — uzilish qayta urinishga xalal bermaydi.
import type { FxRate } from './cbu.ts'

export interface BackfillDeps {
  /** `fx_backfill_dates`: eng yangisidan orqaga. */
  dates: () => Promise<{ dates: string[]; done: boolean }>
  /** Bitta sana uchun CBU kurslari (bo'sh — o'sha kunda e'lon yo'q). */
  ratesFor: (date: string) => Promise<FxRate[]>
  upsert: (rates: FxRate[]) => Promise<number>
  /** `fx_backfill_mark`: kursorni shu sanaga surish. */
  mark: (until: string) => Promise<void>
}

export interface BackfillResult {
  dates: number
  rates: number
  done: boolean
}

/** Vaqt budjeti tugasa — paket to'xtaydi (keyingi ish davom ettiradi). */
export async function backfillRates(
  deps: BackfillDeps,
  { budgetMs, now = () => Date.now() }: { budgetMs: number; now?: () => number },
): Promise<BackfillResult> {
  const started = now()
  const { dates, done } = await deps.dates()
  let rates = 0
  let processed = 0
  let until: string | null = null

  for (const date of dates) {
    if (now() - started > budgetMs) break
    const batch = await deps.ratesFor(date)
    if (batch.length > 0) rates += await deps.upsert(batch)
    processed += 1
    until = date
  }

  // Kursor — ko'rilgan eng eski sana (ro'yxat kamayish tartibida).
  if (until !== null) await deps.mark(until)
  return { dates: processed, rates, done: done && processed === 0 }
}
