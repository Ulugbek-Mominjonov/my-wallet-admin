import { expect, test, type Page } from '@playwright/test'

import { HOUSEHOLD_URL } from './support/app.ts'

async function open(page: Page, path: string, heading: string) {
  await page.goto('/')
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  await page.goto(`${page.url()}/${path}`)
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
}

test.describe('E22-T05', () => {
  test('limit — joriy oy holati bilan', async ({ page }, info) => {
    // Loyihalar bitta owner'da parallel — har biri o'z kategoriyasida (bittadan limit).
    const category = info.project.name === 'mobile' ? 'Kiyim' : "Sovg'a"
    await open(page, 'limits', 'Limitlar')

    await page.getByRole('button', { name: "Limit qo'shish" }).first().click()
    const form = page.getByRole('dialog', { name: 'Yangi limit' })
    await form.getByRole('combobox', { name: 'Kategoriya' }).click()
    await page.getByRole('option', { name: category, exact: true }).click()
    await form.getByLabel('Oylik limit').fill('500 000')
    // E34-T02 (BR-134): qolganini keyingi oyga o'tkazish.
    await form.getByRole('switch', { name: "Qolganini keyingi oyga o'tkazish" }).click()
    await form.getByRole('button', { name: 'Saqlash' }).click()
    await expect(form).toBeHidden()

    const row = page.getByRole('row', { name: new RegExp(category) })
    await expect(row.getByText("500 000 so'm")).toBeVisible()
    await expect(row.getByText("↻ o'tkazish")).toBeVisible()
    await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuetext', "0% — Me'yorda")
  })

  test('tez tugma — chip ko‘rinishi', async ({ page }, info) => {
    const name = `Kofe ${info.project.name} ${String(Date.now()).slice(-5)}`
    await open(page, 'quick-actions', 'Tez tugmalar')

    await page.getByRole('button', { name: "Tez tugma qo'shish" }).first().click()
    const form = page.getByRole('dialog', { name: 'Yangi tez tugma' })
    await form.getByLabel('Nomi').fill(name)
    await form.getByLabel('Summa').fill('25 000')
    await form.getByRole('combobox', { name: 'Kategoriya' }).click()
    await page.getByRole('option', { name: 'Oziq-ovqat', exact: true }).click()
    await form.getByRole('combobox', { name: 'Hisob' }).click()
    await page.getByRole('option', { name: 'Naqd', exact: true }).click()
    await form.getByRole('button', { name: 'Saqlash' }).click()
    await expect(form).toBeHidden()
    await expect(page.getByText(`${name} · 25 000 so'm`)).toBeVisible()
  })

  test('teg — yaratish va o‘chirish', async ({ page }, info) => {
    const name = `E2E teg ${info.project.name} ${String(Date.now())}`
    await open(page, 'tags', 'Teglar')

    await page.getByRole('button', { name: "Teg qo'shish" }).first().click()
    const form = page.getByRole('dialog', { name: 'Yangi teg' })
    await form.getByLabel('Nomi').fill(name)
    await form.getByRole('button', { name: 'Saqlash' }).click()
    await expect(form).toBeHidden()
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible()

    await page.getByRole('button', { name: `${name}: amallar`, exact: true }).click()
    await page.getByRole('menuitem', { name: "O'chirish" }).click()
    await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click()
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  })
})
