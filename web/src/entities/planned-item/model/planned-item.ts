import type { Constants } from '@/shared/api/database.types'
import { addDays } from '@/shared/lib/date'

/** Reja turi — DB enum'idan (entity'lar bir-birini import qilmaydi). */
type PlanKind = (typeof Constants.public.Enums.plan_kind)[number]

/** BR-071: reja holati (saqlanmaydi — bugungi sanadan hisoblanadi). */
export type PlannedStatus = 'paid' | 'partial' | 'pending' | 'overdue' | 'skipped'

export interface PlannedItem {
  id: string
  kind: PlanKind
  name: string
  categoryId: string | null
  /** Taxminiy hisob (to'lashda boshqasi tanlanishi mumkin). */
  accountId: string | null
  /** Asosiy valyutada; `null` — summasi har oy o'zgaradi (BR-070). */
  plannedAmount: number | null
  paidAmount: number
  dueDate: string
  budgetMonth: string
  autoPay: boolean
  debtId: string | null
  /** `personal_allocation` — 👤 fond ajratmasi (BR-060). */
  systemCode: string | null
  settled: boolean
  skipped: boolean
}

/** "Yaqin" bo'limi — bugundan keyingi shuncha kun (mobil bilan bir xil). */
export const SOON_DAYS = 3

/**
 * `private.planned_status` bilan bir xil tartib (contracts/api.md): o'tkazilgan →
 * to'langan → muddati o'tgan → qisman → kutilmoqda.
 */
export function plannedStatus(item: PlannedItem, today: string): PlannedStatus {
  if (item.skipped) return 'skipped'
  if (item.settled) return 'paid'
  if (item.dueDate < today) return 'overdue'
  if (item.paidAmount > 0) return 'partial'
  return 'pending'
}

export const isOpenStatus = (status: PlannedStatus): boolean =>
  status === 'overdue' || status === 'partial' || status === 'pending'

/** Qolgan summa (noma'lum summada — `null`). */
export const plannedRemaining = (item: PlannedItem): number | null =>
  item.plannedAmount === null ? null : Math.max(item.plannedAmount - item.paidAmount, 0)

export interface PlanBoard {
  overdue: PlannedItem[]
  today: PlannedItem[]
  soon: PlannedItem[]
  later: PlannedItem[]
  paid: PlannedItem[]
  skipped: PlannedItem[]
  /** To'lanmagan qoldiq (summasi ma'lumlari, asosiy valyutada). */
  unpaid: number
  /** To'lanmagan, summasi noma'lumlar — `+ N ta ?` (BR-076). */
  unknownCount: number
}

const byDueThenName = (a: PlannedItem, b: PlannedItem) =>
  a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name)

/**
 * E23-T04: rejalar bo'limlari (mobil `PlanBoard` bilan bir xil) — ⚠️ kechikkan ·
 * bugun · yaqin (`soonDays`) · keyinroq · to'langan · o'tkazilgan; jami BR-076.
 */
export function planBoard(
  items: readonly PlannedItem[],
  today: string,
  soonDays = SOON_DAYS,
): PlanBoard {
  const horizon = addDays(today, soonDays)
  const board: PlanBoard = {
    overdue: [],
    today: [],
    soon: [],
    later: [],
    paid: [],
    skipped: [],
    unpaid: 0,
    unknownCount: 0,
  }
  for (const item of items) {
    const status = plannedStatus(item, today)
    if (isOpenStatus(status)) {
      const remaining = plannedRemaining(item)
      if (remaining === null) board.unknownCount++
      else board.unpaid += remaining
    }
    const section =
      status === 'skipped'
        ? board.skipped
        : status === 'paid'
          ? board.paid
          : status === 'overdue'
            ? board.overdue
            : item.dueDate === today
              ? board.today
              : item.dueDate <= horizon
                ? board.soon
                : board.later
    section.push(item)
  }
  for (const section of [
    board.overdue,
    board.today,
    board.soon,
    board.later,
    board.paid,
    board.skipped,
  ]) {
    section.sort(byDueThenName)
  }
  return board
}
