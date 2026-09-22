import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

import { OWNER_STATE } from './e2e/support/state.ts'

const PORT = 4173
const isCI = Boolean(process.env.CI)
// Tashqi muhitga qarshi (wrangler dev, staging): E2E_BASE_URL=https://... pnpm e2e
const externalBaseURL = process.env.E2E_BASE_URL

// Supabase manzili va publishable kaliti: CI — job env, lokal — web/.env.local
// (`make web-env`). Build ham, testlarning API yordamchilari ham shuni oladi.
process.env = { ...loadEnv('production', import.meta.dirname, 'VITE_'), ...process.env }

/**
 * E2E: production build ustida (preview), lokal Supabase bilan; desktop va
 * mobil (360 px atrofi). `setup` bir marta kirib sessiyani saqlaydi.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: externalBaseURL ?? `http://127.0.0.1:${String(PORT)}`,
    trace: 'retain-on-failure',
    locale: 'uz-UZ',
  },
  projects: [
    // Deploy'dan keyingi smoke (E2E_BASE_URL): faqat kirmagan holat — haqiqiy
    // muhitda foydalanuvchi yaratilmaydi, Mailpit shart emas.
    { name: 'public', use: { ...devices['Desktop Chrome'] }, grep: /@public/ },
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], storageState: OWNER_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: OWNER_STATE },
      dependencies: ['setup'],
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `pnpm build && pnpm exec vite preview --port ${String(PORT)} --strictPort`,
        url: `http://127.0.0.1:${String(PORT)}`,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
})
