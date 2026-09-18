// Markaziy bank (cbu.uz) kurslari: [{Ccy, Rate, Nominal, Date: "dd.mm.yyyy"}].
// Kurs so'mda — asosiy valyuta UZS (A7). `rate_to_base = Rate / Nominal`.
// Tashqi javob: noto'g'ri qatorlar tashlanadi, bitta ham yaroqli bo'lmasa — xato.

export const CBU_URL = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/'

export interface FxRate {
  currency: string
  rate_date: string
  rate_to_base: number
}

const CURRENCY = /^[A-Z]{3}$/
const CBU_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/

export function parseCbu(body: unknown): FxRate[] {
  if (!Array.isArray(body)) throw new Error('CBU: massiv kutilgan')
  const rates: FxRate[] = []
  for (const item of body) {
    const currency = String(item?.Ccy ?? '')
    const rate = Number(item?.Rate)
    const nominal = Number(item?.Nominal ?? 1)
    const date = CBU_DATE.exec(String(item?.Date ?? ''))
    if (!CURRENCY.test(currency) || !(rate > 0) || !(nominal > 0) || !date) continue
    rates.push({ currency, rate_date: `${date[3]}-${date[2]}-${date[1]}`, rate_to_base: rate / nominal })
  }
  if (rates.length === 0) throw new Error("CBU: yaroqli kurs yo'q")
  return rates
}
