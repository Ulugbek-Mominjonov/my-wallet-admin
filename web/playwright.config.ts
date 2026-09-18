import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = Boolean(process.env.CI)
// Tashqi muhitga qarshi (wrangler dev, staging): E2E_BASE_URL=https://... pnpm e2e
const externalBaseURL = process.env.E2E_BASE_URL

/** E2E: production build ustida (preview), desktop va mobil (360 px atrofi). */
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
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
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
