// E31-T02 (BR-222): bank botidan forward qilingan karta xabarnomasi —
// shablon (regex) bo'yicha summa, sana, joy va karta oxirgi 4 raqami.
//
// Shablonlar admin paneldagi spravochnikdan (E26-T01) keladi; naqshda
// `amount` guruhi majburiy, `date`, `payee`, `card` — ixtiyoriy.

export interface CardTemplate {
  id: string
  bank: string
  pattern: string
  kind: 'income' | 'expense'
  amount_unit: 'major' | 'minor'
  currency: string
}

export interface CardEntry {
  bank: string
  kind: 'income' | 'expense'
  /** Eng kichik birlikda (BR-001). */
  amount: number
  payee: string
  /** `YYYY-MM-DD` yoki `null` (xabarda sana bo'lmasa — bugun). */
  date: string | null
  card: string | null
}

const MINOR = 100

/** `12.09.2026`, `12.09.26`, `2026-09-12` → `2026-09-12`; boshqasi — null. */
export function normalizeCardDate(value: string | undefined): string | null {
  if (!value) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dotted = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(value)
  if (!dotted) return null
  const [, day = '', month = '', year = ''] = dotted
  const full = year.length === 2 ? `20${year}` : year
  return `${full}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/** Summa: `1 250 000,50` / `1,250,000.50` → eng kichik birlik. */
function parseAmount(raw: string, unit: 'major' | 'minor'): number | null {
  const cleaned = raw.replace(/[\s ]/g, '').replace(/,(\d{3})/g, '$1').replace(',', '.')
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  return unit === 'minor' ? Math.round(value) : Math.round(value * MINOR)
}

/**
 * Birinchi mos shablon bo'yicha xabarni tahlil qiladi; mos kelmasa —
 * `null` (bot "shablon topilmadi" deb javob beradi).
 */
export function parseCardMessage(text: string, templates: readonly CardTemplate[]): CardEntry | null {
  for (const template of templates) {
    let match: RegExpExecArray | null = null
    try {
      match = new RegExp(template.pattern, 'iu').exec(text)
    } catch {
      // Naqsh buzuq bo'lsa — keyingisi (admin panel tekshiradi, lekin server ham yiqilmasin).
      continue
    }
    if (!match?.groups) continue
    const amount = parseAmount(match.groups.amount ?? '', template.amount_unit)
    if (amount === null) continue
    return {
      bank: template.bank,
      kind: template.kind,
      amount,
      payee: (match.groups.payee ?? '').trim(),
      date: normalizeCardDate(match.groups.date),
      card: match.groups.card ?? null,
    }
  }
  return null
}
