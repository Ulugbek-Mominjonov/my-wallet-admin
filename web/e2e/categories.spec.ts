import { expect, test, type Page } from '@playwright/test'

import { HOUSEHOLD_URL } from './support/app.ts'

async function openCategories(page: Page) {
  await page.goto('/')
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  await page.goto(`${page.url()}/categories`)
  await expect(page.getByRole('heading', { level: 1, name: 'Kategoriyalar' })).toBeVisible()
}

const actions = (page: Page, name: string) =>
  page.getByRole('button', { name: `${name}: amallar`, exact: true })

async function addCategory(page: Page, name: string, via?: string) {
  if (via) {
    await actions(page, via).click()
    await page.getByRole('menuitem', { name: "Subkategoriya qo'shish" }).click()
  } else {
    await page.getByRole('button', { name: "Kategoriya qo'shish" }).first().click()
  }
  const form = page.getByRole('dialog', { name: 'Yangi kategoriya' })
  await form.getByLabel('Nomi').fill(name)
  await form.getByRole('button', { name: 'Saqlash' }).click()
  await expect(form).toBeHidden()
}

test.describe('E22-T03: kategoriyalar', () => {
  test('tizim kategoriyasi va daromad turlarining oy siljishi', async ({ page }) => {
    await openCategories(page)
    await expect(page.getByRole('row', { name: /O'zim uchun/ }).getByText('Tizim')).toBeVisible()
    await page.getByRole('tab', { name: 'Daromad' }).click()
    await expect(page.getByRole('row', { name: /Oylik/ }).getByText('Oldingi oy')).toBeVisible()
    await expect(
      page.getByRole('row', { name: /Avans/ }).getByText('Joriy oy (kelgan oyi)'),
    ).toBeVisible()
  })

  test('subkategoriya → birlashtirish → arxiv → o‘chirish', async ({ page }, info) => {
    const suffix = `${info.project.name} ${String(Date.now())}`
    const parent = `E2E ota ${suffix}`
    const child = `E2E bola ${suffix}`
    const other = `E2E boshqa ${suffix}`
    await openCategories(page)

    await addCategory(page, parent)
    await addCategory(page, child, parent)
    await addCategory(page, other)
    // Bola otasidan keyingi qatorda (daraxt).
    const rows = page.locator('tbody tr span.truncate.font-medium')
    const names = await rows.allInnerTexts()
    expect(names.indexOf(child)).toBe(names.indexOf(parent) + 1)

    await actions(page, other).click()
    await page.getByRole('menuitem', { name: 'Birlashtirish' }).click()
    const merge = page.getByRole('dialog', { name: `«${other}» ni birlashtirish` })
    await merge.getByRole('combobox', { name: 'Qaysi kategoriyaga' }).click()
    await page.getByRole('option', { name: child, exact: true }).click()
    await merge.getByRole('button', { name: 'Birlashtirish' }).click()
    await expect(page.getByText(/^Birlashtirildi: 0 amal/)).toBeVisible()
    await expect(actions(page, other)).toHaveCount(0)

    // Bolasi bor kategoriya o'chirilmaydi — server xatosi, qator qaytadi.
    await actions(page, parent).click()
    await page.getByRole('menuitem', { name: "O'chirish" }).click()
    await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click()
    await expect(page.getByText(/Kategoriya ishlatilmoqda/)).toBeVisible()
    await expect(actions(page, parent)).toBeVisible()

    await actions(page, child).click()
    await page.getByRole('menuitem', { name: "O'chirish" }).click()
    await page.getByRole('dialog').getByRole('button', { name: "O'chirish" }).click()
    await expect(actions(page, child)).toHaveCount(0)

    await actions(page, parent).click()
    await page.getByRole('menuitem', { name: 'Arxivlash' }).click()
    await expect(actions(page, parent)).toHaveCount(0)
    await page.getByText('Arxivdagilar').click()
    await expect(
      page.getByRole('row', { name: new RegExp(parent) }).getByText('Arxivda'),
    ).toBeVisible()
  })
})
