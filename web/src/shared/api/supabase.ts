import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/shared/api/database.types'
import { env } from '@/shared/config/env'

/**
 * Yagona Supabase klienti. Ma'lumotga murojaat faqat `features/*\/api` ichida
 * (CONTRIBUTING 5-bo'lim); komponentlar uni to'g'ridan-to'g'ri chaqirmaydi.
 */
export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
