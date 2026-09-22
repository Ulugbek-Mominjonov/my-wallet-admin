import { expect, test, type Page } from '@playwright/test'

import { HOUSEHOLD_URL, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { uniqueEmail } from './support/supabase.ts'

/** Owner byudjetining hisoblar sahifasi (URL — joriy byudjetdan). */
async function openAccounts(page: Page) {
  await page.goto('/')
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  await page.goto(`${page.url()}/accounts`)
  await expect(page.getByRole('heading', { level: 1, name: 'Hisoblar' })).toBeVisible()
}

const row = (page: Page, name: string) => page.getByRole('row', { name: new RegExp(name) })

test.describe('E22-T02: hisoblar', () => {
  test('standart hisoblar: 👤 fond — tizim, amallarsiz arxiv/o‘chirish', async ({ page }) => {
    await openAccounts(page)
    await expect(row(page, 'Shaxsiy fond').getByText('Tizim')).toBeVisible()
    await row(page, 'Shaxsiy fond')
      .getByRole('button', { name: /amallar/ })
      .click()
    await expect(page.getByRole('menuitem', { name: 'Tahrirlash' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Arxivlash' })).toHaveCount(0)
  })

  test('yaratish → tahrirlash → arxiv → qaytarish → o‘chirish', async ({ page }, info) => {
    const name = `E2E ${info.project.name} ${String(Date.now())}`
    await openAccounts(page)

    await page.getByRole('button', { name: "Hisob qo'shish" }).first().click()
    const form = page.getByRole('dialog', { name: 'Yangi hisob' })
    await form.getByLabel('Nomi').fill(name)
    await form.getByLabel("Boshlang'ich qoldiq").fill('250 000')
    await form.getByRole('button', { name: 'Saqlash' }).click()
    await expect(form).toBeHidden()
    await expect(row(page, name).getByText("250 000 so'm")).toBeVisible()

    await row(page, name).getByRole('button', { name, exact: true }).click()
    const edit = page.getByRole('dialog', { name: 'Hisobni tahrirlash' })
    await edit.getByLabel('Nomi').fill(`${name} (tahrir)`)
    await edit.getByRole('button', { name: 'Saqlash' }).click()
    await expect(row(page, `${name} \\(tahrir\\)`)).toBeVisible()

    const renamed = `${name} (tahrir)`
    await row(page, `${name} \\(tahrir\\)`)
      .getByRole('button', { name: /amallar/ })
      .click()
    await page.getByRole('menuitem', { name: 'Arxivlash' }).click()
    await expect(page.getByRole('button', { name: renamed, exact: true })).toBeHidden()

    await page.getByText('Arxivdagilar').click()
    await expect(row(page, `${name} \\(tahrir\\)`).getByText('Arxivda')).toBeVisible()
    await row(page, `${name} \\(tahrir\\)`)
      .getByRole('button', { name: /amallar/ })
      .click()
    await page.getByRole('menuitem', { name: 'Arxivdan qaytarish' }).click()
    await expect(row(page, `${name} \\(tahrir\\)`).getByText('Arxivda')).toBeHidden()

    await row(page, `${name} \\(tahrir\\)`)
      .getByRole('button', { name: /amallar/ })
      .click()
    await page.getByRole('menuitem', { name: "O'chirish" }).click()
    await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click()
    await expect(page.getByRole('button', { name: renamed, exact: true })).toBeHidden()
    await page.reload()
    await expect(page.getByRole('button', { name: renamed, exact: true })).toHaveCount(0)
  })

  test.describe('tartib', () => {
    // Alohida foydalanuvchi: boshqa testlar owner hisoblarini parallel o'zgartiradi.
    test.use({ storageState: SIGNED_OUT })

    test('klaviatura bilan (dnd-kit) — qayta yuklashda saqlanadi', async ({ page, isMobile }) => {
      test.skip(isMobile, 'tartib — desktop (klaviatura) loyihasida yetarli')
      await page.goto('/login')
      await signIn(page, uniqueEmail('order'))
      await expect(page).toHaveURL(HOUSEHOLD_URL)
      await page.goto(`${page.url()}/accounts`)
      // Qatorlardagi hisob nomlari (belgi va badge'larsiz), ekrandagi tartibda.
      const names = () => page.locator('tbody tr span.truncate.font-medium').allInnerTexts()

      await expect.poll(names).toEqual(['Naqd', 'Karta', 'Shaxsiy fond'])
      // Har qadamdan keyin ekran o'quvchi e'lonini kutamiz (dnd-kit o'lchashni tugatadi).
      const live = page.getByRole('status').filter({ hasText: 'Shaxsiy fond' })
      await page.getByRole('button', { name: "Tartibni o'zgartirish: Shaxsiy fond" }).focus()
      await page.keyboard.press('Space')
      await expect(live).toHaveText('Shaxsiy fond olindi')
      await page.keyboard.press('ArrowUp')
      await expect(live).toHaveText("Shaxsiy fond — Karta o'rnida")
      await page.keyboard.press('ArrowUp')
      await expect(live).toHaveText("Shaxsiy fond — Naqd o'rnida")
      // Tartib optimistik ko'rinadi — qayta yuklashdan oldin server javobini kutamiz.
      const saved = page.waitForResponse((r) => r.url().includes('/rpc/set_sort_order') && r.ok())
      await page.keyboard.press('Space')
      await saved

      const expected = ['Shaxsiy fond', 'Naqd', 'Karta']
      await expect.poll(names).toEqual(expected)
      await page.reload()
      await expect.poll(names).toEqual(expected)
    })
  })
})
