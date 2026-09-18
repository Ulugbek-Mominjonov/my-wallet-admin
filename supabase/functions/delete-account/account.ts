// BR-015: akkauntni o'chirish. Tartib: JWT tekshiruvi (Auth) → byudjetlar
// (`prepare_account_deletion` foydalanuvchi huquqi bilan) → auth foydalanuvchisi.
// Ikkinchi qadamdan keyin xato bo'lsa — qayta chaqirish xavfsiz (idempotent).
// Chek fayllarini kunlik `purge-files` tozalaydi (byudjeti yo'q fayllar — darhol).
import { RpcError } from '../_shared/supabase.ts'

export interface AccountDeps {
  userId(jwt: string): Promise<string | null>
  prepare(jwt: string): Promise<{ deleted_households: string[] }>
  deleteUser(userId: string): Promise<void>
}

export interface AccountResult {
  status: number
  body: Record<string, unknown>
}

export function bearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')
  return match ? match[1] : null
}

export async function deleteAccount(authorization: string | null, deps: AccountDeps): Promise<AccountResult> {
  const jwt = bearerToken(authorization)
  const userId = jwt ? await deps.userId(jwt) : null
  if (!jwt || !userId) return { status: 401, body: { error: 'unauthorized' } }

  let prepared: { deleted_households: string[] }
  try {
    prepared = await deps.prepare(jwt)
  } catch (error) {
    // BR-014: oxirgi owner — avval egalikni o'tkazishi kerak.
    if (error instanceof RpcError && error.message === 'last_owner') {
      return { status: 409, body: { error: 'last_owner' } }
    }
    throw error
  }
  await deps.deleteUser(userId)
  return { status: 200, body: { deleted_households: prepared.deleted_households.length } }
}
