import { z } from 'zod'

/** Eksport faylining tekshiriladigan qismi (qolgani serverda ishlatiladi). */
const payloadSchema = z.object({
  version: z.literal(1),
  incomes: z.array(z.unknown()).optional(),
  expenses: z.array(z.unknown()).optional(),
  personalSpends: z.array(z.unknown()).optional(),
  debts: z.array(z.unknown()).optional(),
  goals: z.array(z.unknown()).optional(),
  expectedMonths: z.array(z.unknown()).optional(),
})

export interface LegacySummary {
  incomes: number
  expenses: number
  personalSpends: number
  debts: number
  goals: number
  months: number
}

export type LegacyFileError = 'invalid_json' | 'unsupported_version'

/**
 * Fayl mazmuni → serverga yuboriladigan payload (o'zgartirilmagan JSON) va
 * qisqa hisob. Payload kesilmaydi: `settings` va `expectedMonths` to'liq
 * holda serverga kerak (tekshiruv etaloni — BR-181).
 */
export function parseLegacyFile(
  text: string,
): { payload: unknown; summary: LegacySummary } | { error: LegacyFileError } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { error: 'invalid_json' }
  }
  const parsed = payloadSchema.safeParse(json)
  if (!parsed.success) return { error: 'unsupported_version' }
  const { incomes, expenses, personalSpends, debts, goals, expectedMonths } = parsed.data
  return {
    payload: json,
    summary: {
      incomes: incomes?.length ?? 0,
      expenses: expenses?.length ?? 0,
      personalSpends: personalSpends?.length ?? 0,
      debts: debts?.length ?? 0,
      goals: goals?.length ?? 0,
      months: expectedMonths?.length ?? 0,
    },
  }
}
