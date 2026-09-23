import { mergeConfig } from 'vite'
import { defineConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['./src/shared/test/setup.ts'],
      // MSW so'rovlarni shu manzilda ushlaydi — lokal `.env.local` ga bog'liq emas.
      env: {
        VITE_SUPABASE_URL: 'http://supabase.test',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        VITE_APP_ENV: 'local',
        VITE_TELEGRAM_BOT: 'mywallet_test_bot',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['src/**/*.gen.ts', 'src/shared/ui/**'],
      },
    },
  }),
)
