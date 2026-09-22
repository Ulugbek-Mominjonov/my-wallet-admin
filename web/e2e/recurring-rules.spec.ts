import { expect, test, type Page } from '@playwright/test'

import { HOUSEHOLD_URL } from './support/app.ts'

async function openRules(page: Page) {
  await page.goto('/')
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  await page.goto(`${page.url()}/recurring-rules`)
  await expect(page.getByRole('heading', { level: 1, name: 'Doimiy rejalar' })).toBeVisible()
}

test('E22-T04: doimiy reja — yaratish → keyingi oy preview → to‘xtatish → o‘chirish', async ({
  page,
}, info) => {
  const name = `E2E ijara ${info.project.name} ${String(Date.now())}`
  await openRules(page)

  await page.getByRole('button', { name: "Doimiy reja qo'shish" }).first().click()
  const form = page.getByRole('dialog', { name: 'Yangi doimiy reja' })
  await form.getByLabel('Nomi').fill(name)
  await form.getByRole('combobox', { name: 'Kategoriya' }).click()
  await page.getByRole('option', { name: 'Ijara', exact: true }).click()
  await form.getByLabel('Summa').fill('3 000 000')
  await form.getByLabel('Kuni').fill('5')
  await form.getByRole('button', { name: 'Saqlash' }).click()
  await expect(form).toBeHidden()
  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row.getByText("3 000 000 so'm")).toBeVisible()

  // Serverdagi haqiqiy preview: yangi qoida keyingi oyda reja bo'lib chiqadi.
  await page.getByRole('button', { name: 'Keyingi oy' }).click()
  const preview = page.getByRole('dialog', { name: /oy ochilganda/ })
  await expect(preview.getByText(name)).toBeVisible()
  await preview.getByRole('button', { name: 'Yopish' }).click()

  const active = page.getByRole('switch', { name: `${name}: Faol` })
  await active.click()
  await expect(active).not.toBeChecked()
  await page.reload()
  await expect(page.getByRole('switch', { name: `${name}: Faol` })).not.toBeChecked()

  await page.getByRole('button', { name: `${name}: amallar`, exact: true }).click()
  await page.getByRole('menuitem', { name: "O'chirish" }).click()
  await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click()
  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0)
})
