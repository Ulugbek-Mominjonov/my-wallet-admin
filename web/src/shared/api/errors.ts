/** Foydalanuvchiga ko'rsatiladigan xato: aniq kod va tushunarli matn. */
export class AppError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }
}

interface PostgrestLikeError {
  code?: string
  message: string
  status?: number
}

const isPostgrestLike = (value: unknown): value is PostgrestLikeError =>
  typeof value === 'object' && value !== null && 'message' in value

/**
 * Supabase/tarmoq xatosini AppError'ga aylantiradi. Biznes xato kodlari
 * (`contracts/api.md`) E08 da qo'shiladi; hozircha umumiy holatlar.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof TypeError) {
    return new AppError('network', "Server bilan aloqa yo'q. Internetni tekshiring.", {
      cause: error,
    })
  }
  if (isPostgrestLike(error)) {
    if (error.status === 401 || error.code === 'PGRST301') {
      return new AppError('unauthorized', 'Sessiya tugagan. Qayta kiring.', { cause: error })
    }
    if (error.status === 403 || error.code === '42501') {
      return new AppError('forbidden', "Bu amal uchun huquqingiz yo'q.", { cause: error })
    }
    return new AppError(error.code ?? 'unknown', error.message, { cause: error })
  }
  return new AppError('unknown', "Kutilmagan xato. Qayta urinib ko'ring.", { cause: error })
}

/** Qayta urinish ma'noga ega emas: huquq/sessiya/validatsiya xatolari. */
export const isRetryable = (error: unknown): boolean =>
  !['unauthorized', 'forbidden'].includes(toAppError(error).code)
