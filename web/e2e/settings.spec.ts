import { expect, test, type Page } from '@playwright/test'

import { HOUSEHOLD_URL, openHouseholdSwitcher, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { uniqueEmail } from './support/supabase.ts'

/** Yangi foydalanuvchi (o'z "Shaxsiy byudjet"i bilan) — boshqa testlarga ta'sir qilmaydi. */
async function freshOwnerSettings(page: Page, prefix: string) {
  await page.goto('/login')
  await signIn(page, uniqueEmail(prefix))
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  await page.goto(`${page.url()}/settings`)
  await expect(page.getByRole('heading', { level: 1, name: 'Byudjet sozlamalari' })).toBeVisible()
}

test.describe('E22-T07: byudjet sozlamalari', () => {
  test.use({ storageState: SIGNED_OUT })

  test('nom, fond qoidasi va oy siyosati saqlanadi', async ({ page, isMobile }) => {
    await freshOwnerSettings(page, 'settings')

    await page.getByLabel('Byudjet nomi').fill('Oila E2E')
    await page.getByRole('button', { name: 'Saqlash' }).first().click()
    await expect(page.getByText('Sozlamalar saqlandi').first()).toBeVisible()
    await openHouseholdSwitcher(page, isMobile, 'Oila E2E')
    // Menyu, mobilda esa sidebar (drawer) ham yopiladi.
    await page.keyboard.press('Escape')
    if (isMobile) await page.keyboard.press('Escape')

    await page.getByLabel('Foiz').fill('15')
    await page.getByRole('button', { name: 'Saqlash' }).nth(1).click()
    const strict = page.getByRole('switch', { name: 'Qattiq qulf' })
    await strict.click()
    await expect(strict).toBeChecked()

    await page.reload()
    await expect(page.getByLabel('Byudjet nomi')).toHaveValue('Oila E2E')
    await expect(page.getByLabel('Foiz')).toHaveValue('15')
    await expect(page.getByRole('switch', { name: 'Qattiq qulf' })).toBeChecked()
  })

  test("xavfli zona: nom bilan tasdiqlab o'chirish → byudjetsiz — sozlash sahifasi", async ({
    page,
  }) => {
    await freshOwnerSettings(page, 'delete')

    await page.getByRole('button', { name: "Byudjetni o'chirish" }).click()
    const dialog = page.getByRole('dialog', { name: "Byudjetni o'chirish" })
    const confirm = dialog.getByRole('button', { name: "Byudjetni o'chirish" })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox').fill('shaxsiy byudjet')
    await confirm.click()

    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.getByRole('heading', { name: 'Byudjetni boshlang' })).toBeVisible()
  })
})
