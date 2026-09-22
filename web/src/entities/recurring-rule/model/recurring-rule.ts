import { Constants } from '@/shared/api/database.types'

/** BR-080: doimiy reja turlari — xarajat, daromad yoki 👤 fondga ajratma. */
export const PLAN_KINDS = Constants.public.Enums.plan_kind
export type PlanKind = (typeof PLAN_KINDS)[number]

export interface RecurringRule {
  id: string
  kind: PlanKind
  name: string
  /** Ajratmada yo'q ("O'zim uchun" avtomatik), qolganida majburiy. */
  categoryId: string | null
  /** Standart hisob; ajratmada — manba hisob. */
  accountId: string | null
  /** Eng kichik birlikda; `null` — har oy o'zgaradi. */
  amount: number | null
  /** 1–31; qisqa oyda oxirgi kunga qisiladi. */
  dayOfMonth: number
  autoPay: boolean
  active: boolean
  debtId: string | null
  /** Oyning 1-kuni (`YYYY-MM-01`) yoki cheklovsiz. */
  startMonth: string | null
  endMonth: string | null
  sortOrder: number
}
