import { expect, test, type Page } from '@playwright/test'

import { HOUSEHOLD_URL } from './support/app.ts'

async function open(page: Page, path: string, heading: string) {
  await page.goto('/')
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  await page.goto(`${page.url()}/${path}`)
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
}

test.describe('E22-T06', () => {
  test('qarz — qolgan, tugash oyi va holat serverdan (debt_balances)', async ({ page }, info) => {
    const name = `E2E kredit ${info.project.name} ${String(Date.now())}`
    await open(page, 'debts', 'Qarzlar')

    await page.getByRole('button', { name: "Qarz qo'shish" }).first().click()
    const form = page.getByRole('dialog', { name: 'Yangi qarz' })
    await form.getByLabel('Nomi').fill(name)
    await form.getByLabel('Umumiy summa').fill('12 000 000')
    await form.getByLabel("Oldin to'langan").fill('2 000 000')
    await form.getByLabel("Oylik to'lov").fill('1 000 000')
    await form.getByRole('button', { name: 'Saqlash' }).click()
    await expect(form).toBeHidden()

    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row.getByText("10 000 000 so'm")).toBeVisible()
    await expect(row.getByText(/^10 oy \(/)).toBeVisible()
    await expect(row.getByText("Bog'lanmagan")).toBeVisible()
    await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '17%')
  })

  test('maqsad — prognoz serverdan (goal_progress)', async ({ page }, info) => {
    const name = `E2E maqsad ${info.project.name} ${String(Date.now())}`
    await open(page, 'goals', 'Maqsadlar')

    await page.getByRole('button', { name: "Maqsad qo'shish" }).first().click()
    const form = page.getByRole('dialog', { name: 'Yangi maqsad' })
    await form.getByLabel('Nomi').fill(name)
    await form.getByLabel('Kerakli summa').fill('10 000 000')
    await form.getByLabel("Yig'ilgan (qo'lda)").fill('4 000 000')
    await form.getByLabel('Oyiga ajratma').fill('2 000 000')
    await form.getByRole('button', { name: 'Saqlash' }).click()
    await expect(form).toBeHidden()

    const row = page.getByRole('row', { name: new RegExp(name) })
    await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '40%')
    await expect(row.getByText(/^3 oy \(/)).toBeVisible()
  })
})
