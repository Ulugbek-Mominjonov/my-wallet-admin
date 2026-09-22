import { expect, test, type Page } from '@playwright/test'

import { accessToken, HOUSEHOLD_URL, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { insert, select, uniqueEmail } from './support/supabase.ts'

/** Byudjet vaqt zonasi (standart) — "joriy oy" sahifadagi bilan bir xil. */
const TIMEZONE = 'Asia/Tashkent'

interface Ref {
  id: string
  name: string
}

/**
 * Yangi foydalanuvchi va uning byudjetiga 3 ta amal (joriy oy). Amal
 * formasi E23-T02 da — hozircha shu foydalanuvchi nomidan PostgREST orqali.
 */
async function ownerWithTransactions(page: Page): Promise<string> {
  await page.goto('/login')
  await signIn(page, uniqueEmail('tx'))
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
  const token = await accessToken(page)

  const [accounts, categories] = await Promise.all([
    select<(Ref & { type: string })[]>(
      token,
      `accounts?select=id,name,type&household_id=eq.${householdId}`,
    ),
    select<Ref[]>(
      token,
      `categories?select=id,name&household_id=eq.${householdId}&kind=eq.expense`,
    ),
  ])
  const accountId = (type: string) => accounts.find((a) => a.type === type)?.id
  const categoryId = (name: string) => categories.find((c) => c.name === name)?.id
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
  const month = `${today.slice(0, 7)}-01`
  // PostgREST ommaviy yozuvida hamma qatorda kalitlar bir xil bo'lishi shart.
  const base = {
    household_id: householdId,
    occurred_on: today,
    budget_month: month,
    to_account_id: null,
    category_id: null,
  }
  await insert(token, 'transactions', [
    {
      ...base,
      kind: 'expense',
      account_id: accountId('cash'),
      category_id: categoryId('Oziq-ovqat'),
      amount: 5000000,
      payee: 'Korzinka',
    },
    {
      ...base,
      kind: 'expense',
      account_id: accountId('card'),
      category_id: categoryId('Transport'),
      amount: 3000000,
      payee: 'Yandex Go',
    },
    {
      ...base,
      kind: 'transfer',
      account_id: accountId('card'),
      to_account_id: accountId('cash'),
      amount: 10000000,
      payee: 'Bankomat',
    },
  ])
  return householdId
}

test.describe('E23: amallar jadvali va formasi', () => {
  test.use({ storageState: SIGNED_OUT })

  test('filtr URL’da saqlanadi: qidiruv (xato bilan ham), tur, tozalash', async ({ page }) => {
    const householdId = await ownerWithTransactions(page)
    await page.goto(`/h/${householdId}/transactions`)

    const table = page.getByRole('table', { name: 'Amallar' })
    await expect(table.getByRole('row')).toHaveCount(4)
    const summary = page.getByRole('region', { name: "Filtr bo'yicha jami" })
    await expect(summary).toContainText("80 000 so'm")

    // BR-202: bitta harf xatosi bilan ham topiladi.
    await page.getByRole('searchbox', { name: "Joy yoki izoh bo'yicha qidirish" }).fill('karzinka')
    await expect(page).toHaveURL(/q=karzinka/)
    await expect(table.getByRole('row')).toHaveCount(2)
    await expect(table).toContainText('Korzinka')
    await expect(summary).toContainText("50 000 so'm")

    // Ulashiladigan havola: qayta yuklansa ham filtr joyida.
    await page.reload()
    await expect(
      page.getByRole('searchbox', { name: "Joy yoki izoh bo'yicha qidirish" }),
    ).toHaveValue('karzinka')
    await expect(table.getByRole('row')).toHaveCount(2)

    await page.getByRole('button', { name: 'Tozalash' }).click()
    await expect(table.getByRole('row')).toHaveCount(4)

    await page.getByRole('button', { name: "O'tkazma" }).click()
    await expect(table.getByRole('row')).toHaveCount(2)
    await expect(table).toContainText('Bankomat')
  })

  test('forma: yaratish → joy nomidan avto-to‘ldirish → tahrirlash → o‘chirish', async ({
    page,
  }) => {
    const householdId = await ownerWithTransactions(page)
    await page.goto(`/h/${householdId}/transactions`)
    const table = page.getByRole('table', { name: 'Amallar' })
    await expect(table.getByRole('row')).toHaveCount(4)

    await page.getByRole('button', { name: "Amal qo'shish" }).click()
    let dialog = page.getByRole('dialog', { name: 'Yangi amal' })
    await expect(dialog.getByText("qoida bo'yicha")).toBeVisible()
    await dialog.getByLabel('Summa (UZS)').fill('25 000')
    await dialog.getByRole('combobox', { name: 'Hisob' }).click()
    await page.getByRole('option', { name: 'Karta' }).click()
    await dialog.getByRole('combobox', { name: 'Kategoriya' }).click()
    await page.getByRole('option', { name: 'Transport' }).click()
    await dialog.getByLabel('Joy / nomi').fill('Metro')
    await dialog.getByRole('button', { name: 'Saqlash' }).click()
    await expect(dialog).toBeHidden()
    await expect(table.getByRole('row')).toHaveCount(5)
    await expect(table.getByRole('row', { name: /Metro/ })).toContainText("−25 000 so'm")

    // BR-056: shu nom qayta yozilsa — oxirgi kategoriya va hisob taklif qilinadi.
    await page.getByRole('button', { name: "Amal qo'shish" }).click()
    dialog = page.getByRole('dialog', { name: 'Yangi amal' })
    const payee = dialog.getByLabel('Joy / nomi')
    await payee.pressSequentially('Met')
    await expect(page.locator('#tx-payee-suggestions option[value="Metro"]')).toHaveCount(1)
    await payee.pressSequentially('ro')
    await expect(dialog.getByRole('combobox', { name: 'Kategoriya' })).toContainText('Transport')
    await expect(dialog.getByRole('combobox', { name: 'Hisob' })).toContainText('Karta')
    await dialog.getByRole('button', { name: 'Bekor qilish' }).click()

    await page.getByRole('button', { name: 'Metro: amallar' }).click()
    await page.getByRole('menuitem', { name: 'Tahrirlash' }).click()
    dialog = page.getByRole('dialog', { name: 'Amalni tahrirlash' })
    await dialog.getByLabel('Summa (UZS)').fill('30 000')
    await dialog.getByRole('button', { name: 'Saqlash' }).click()
    await expect(table.getByRole('row', { name: /Metro/ })).toContainText("−30 000 so'm")

    await page.getByRole('button', { name: 'Metro: amallar' }).click()
    await page.getByRole('menuitem', { name: "O'chirish" }).click()
    await page
      .getByRole('dialog', { name: "Amal o'chirilsinmi?" })
      .getByRole('button', { name: "O'chirish" })
      .click()
    await expect(table.getByRole('row')).toHaveCount(4)
  })
})
