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
})
