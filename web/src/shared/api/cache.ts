import type { QueryClient } from '@tanstack/react-query'

import { MONEY_KEYS, part } from '@/shared/api/query-keys'

/** Yozuvdan keyin darhol qayta so'raladigan bo'lim (ko'rinib turgan ro'yxat). */
const ACTIVE = 'transactions'

/**
 * E24-T07: amal yoki reja to'lovi yozilgandan keyin eskiradigan keshlar —
 * qoldiq, reja, oy holati, hisobot, limit, qarz va maqsad. Spravochniklar
 * (kategoriya, teg, a'zo, sozlama) tegilmaydi: ularni pul harakati
 * o'zgartirmaydi. Faqat amallar ro'yxati darhol yangilanadi, qolganlari
 * keyingi ochilishda.
 */
export async function invalidateMoneyWrite(
  queryClient: QueryClient,
  householdId: string,
): Promise<void> {
  await Promise.all(
    MONEY_KEYS.map((name) =>
      queryClient.invalidateQueries({
        queryKey: part(householdId, name),
        refetchType: name === ACTIVE ? 'active' : 'none',
      }),
    ),
  )
}
