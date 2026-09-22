import { Constants } from '@/shared/api/database.types'

/** BR-020: hisob turlari (DB enum bilan bir manba). */
export const ACCOUNT_TYPES = Constants.public.Enums.account_type
export type AccountType = (typeof ACCOUNT_TYPES)[number]

/** Foydalanuvchi yaratadigan turlar: 👤 fond — byudjetda bitta, tizim yaratadi. */
export const CREATABLE_ACCOUNT_TYPES = ACCOUNT_TYPES.filter(
  (type): type is Exclude<AccountType, 'personal_fund'> => type !== 'personal_fund',
)

/** Ikon tanlanmagan hisob — turiga mos neytral ikon kaliti. */
export const ACCOUNT_TYPE_ICON: Record<AccountType, string> = {
  cash: 'banknote',
  card: 'credit-card',
  bank: 'bank',
  ewallet: 'phone',
  deposit: 'piggy-bank',
  personal_fund: 'user',
  other: 'wallet',
}

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: string
  /** Eng kichik birlikda (BR-001); kredit karta — manfiy. */
  openingBalance: number
  openingDate: string
  icon: string | null
  color: string | null
  sortOrder: number
  archivedAt: string | null
  /** Joriy qoldiq (`account_balances`, hisob valyutasida). */
  balance: number
}

/** BR-020: 👤 fond hisobi — turi o'zgarmaydi, arxivlanmaydi, o'chirilmaydi. */
export const isSystemAccount = (account: Pick<Account, 'type'>): boolean =>
  account.type === 'personal_fund'
