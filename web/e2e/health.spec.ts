import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { HOUSEHOLD_URL, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { uniqueEmail } from './support/supabase.ts'

test.describe('E25-T01: tekshiruv', () => {
  test.use({ storageState: SIGNED_OUT })

  test("yangi byudjet: ogohlantirish va amal havolasi; ma'lumot bo'limi", async ({ page }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('health'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''

    await page.goto(`/h/${householdId}/health`)
    await expect(page.getByRole('heading', { level: 1, name: 'Tekshiruv' })).toBeVisible()

    // Yangi byudjetda doimiy reja yo'q — ogohlantirish va unga mos havola.
    await expect(page.getByText(/Aktiv doimiy reja yo'q/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Doimiy rejalar' }).first()).toBeVisible()

    // Ma'lumot bo'limi: daromad turlari shablondan.
    await expect(page.getByText('Daromad turlari')).toBeVisible()
    await expect(page.getByText(/Oylik/).first()).toBeVisible()

    await page.getByRole('button', { name: 'Qayta tekshirish' }).click()
    await expect(page.getByText(/Aktiv doimiy reja yo'q/)).toBeVisible()
  })

  test('E25-T02: to‘liq zaxira JSON va rejalar CSV yuklab olinadi', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('export'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''

    await page.goto(`/h/${householdId}/export`)
    const backup = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Zaxirani yuklab olish' }).click()
    const file = await backup
    expect(file.suggestedFilename()).toMatch(/^shaxsiy-byudjet-\d{4}-\d{2}\.json$/)
    const json = JSON.parse(await readFile(await file.path(), 'utf8')) as {
      accounts: unknown[]
      categories: unknown[]
      members: unknown[]
    }
    // Yangi byudjet shabloni: hisoblar, kategoriyalar va bitta a'zo.
    expect(json.accounts.length).toBeGreaterThan(0)
    expect(json.categories.length).toBeGreaterThan(0)
    expect(json.members).toHaveLength(1)

    const plans = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Rejalarni yuklab olish' }).click()
    expect((await plans).suggestedFilename()).toMatch(/^rejalar-.*\.csv$/)
  })
})
