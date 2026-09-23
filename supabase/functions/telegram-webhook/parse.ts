// E31-T01 (BR-220): botga yozilgan matndan amal — summa, nom va ishora.
//
//   `taksi 20000`, `20000 taksi`, `+5 000 000 oylik`, `kofe 25k`
//
// Summa — so'mda (butun yoki `k`/`ming` qisqartmasi bilan); natija eng
// kichik birlikda (BR-001). `+` — daromad, aks holda xarajat.
// Kasr qismi `.`/`,` bilan (`12,5k` — 12 500).

/** Matndagi summa: ixtiyoriy ishora, raqamlar (bo'shliq bilan), `k`/`ming`. */
const AMOUNT = /(^|\s)([+-])?\s*(\d[\d\s ]*(?:[.,]\d{1,2})?)\s*(k|ming|тыс|min)?(?=\s|$)/iu

/** UZS eng kichik birligi (tiyin). */
const MINOR = 100
const THOUSAND = 1000

export interface QuickEntry {
  kind: 'income' | 'expense'
  /** Eng kichik birlikda (tiyin). */
  amount: number
  /** Joy yoki nom (bo'sh bo'lishi mumkin). */
  payee: string
}

/** Matn → amal; summa topilmasa yoki 0 bo'lsa — `null`. */
export function parseQuickEntry(text: string): QuickEntry | null {
  const input = text.trim()
  if (input === '') return null
  const match = AMOUNT.exec(input)
  if (!match) return null

  const [, , sign = '', digits = '', suffix] = match
  const value = Number(digits.replace(/[\s ]/g, '').replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null

  const multiplier = suffix ? THOUSAND : 1
  const amount = Math.round(value * multiplier * MINOR)
  if (amount <= 0) return null

  const payee = (input.slice(0, match.index) + ' ' + input.slice(match.index + match[0].length))
    .replace(/\s+/g, ' ')
    .trim()

  return { kind: sign === '+' ? 'income' : 'expense', amount, payee }
}
