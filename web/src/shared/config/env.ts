import { z } from 'zod'

/**
 * Build paytida kiritiladigan (VITE_*) sozlamalar — brauzerga ochiq.
 * Bu yerda faqat publishable kalit bo'lishi mumkin; secret kalit hech qachon.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  /** Telegram bot nomi (`t.me/<bot>`); bo'sh — ulash ko'rsatilmaydi (BR-163). */
  VITE_TELEGRAM_BOT: z.string().default(''),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  // Konfiguratsiya xatosi — ilova umuman ishlay olmaydi, darhol aniq xabar.
  throw new Error(
    `Muhit o'zgaruvchilari noto'g'ri (web/.env.example ga qarang): ${z.prettifyError(parsed.error)}`,
  )
}

export const env = parsed.data
