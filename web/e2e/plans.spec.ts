import { expect, test, type Page } from '@playwright/test'

import { accessToken, HOUSEHOLD_URL, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { insert, select, uniqueEmail } from './support/supabase.ts'

/** Byudjet vaqt zonasi (standart) — "bugun" sahifadagi bilan bir xil. */
const TIMEZONE = 'Asia/Tashkent'

/** Yangi foydalanuvchi va joriy oyda 2 ta reja (oyni ochish UI'si — E23-T05). */
async function ownerWithPlans(page: Page): Promise<string> {
  await page.goto('/login')
  await signIn(page, uniqueEmail('plans'))
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
  const token = await accessToken(page)
  const [accounts, categories] = await Promise.all([
    select<{ id: string; type: string }[]>(
      token,
      `accounts?select=id,type&household_id=eq.${householdId}`,
    ),
    select<{ id: string; name: string }[]>(
      token,
      `categories?select=id,name&household_id=eq.${householdId}&kind=eq.expense`,
    ),
  ])
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
  const base = {
    household_id: householdId,
    kind: 'expense',
    account_id: accounts.find((a) => a.type === 'cash')?.id,
    category_id: categories.find((c) => c.name === 'Kommunal')?.id ?? categories[0]?.id,
    due_date: today,
    budget_month: `${today.slice(0, 7)}-01`,
  }
  await insert(token, 'planned_items', [
    { ...base, name: 'Ijara', planned_amount: 30000000 },
    { ...base, name: 'Svet', planned_amount: null },
  ])
  return householdId
}

test.describe('E23-T04: rejalar', () => {
  test.use({ storageState: SIGNED_OUT })

  test("To'landi → to'langan bo'limiga; ommaviy — summasi noma'lumi sababi bilan", async ({
    page,
  }) => {
    const householdId = await ownerWithPlans(page)
    await page.goto(`/h/${householdId}/plans`)

    const today = page.getByRole('region', { name: 'Bugun · 2' })
    await expect(today).toBeVisible()
    await expect(page.getByText('+ 1 ta ?')).toBeVisible()

    await today
      .getByRole('row', { name: /Ijara/ })
      .getByRole('button', { name: "To'landi" })
      .click()
    const dialog = page.getByRole('dialog', { name: "«Ijara» — to'lov" })
    await expect(dialog.getByLabel('Summa (UZS)')).toHaveValue('300\u00a0000')
    await dialog.getByRole('button', { name: "To'landi" }).click()
    await expect(page.getByRole('region', { name: "To'langan · 1" })).toContainText('Ijara')

    await page.getByRole('checkbox', { name: 'Tanlash: Svet' }).check()
    await page
      .getByRole('region', { name: 'Tanlangan: 1' })
      .getByRole('button', { name: "Tanlanganlarni to'lash" })
      .click()
    await page
      .getByRole('dialog', { name: "Tanlangan rejalarni to'lash" })
      .getByRole('button', { name: "Tanlanganlarni to'lash" })
      .click()
    await expect(page.getByText("To'landi: 0, o'tkazildi: 1")).toBeVisible()
    await expect(page.getByText("Summasi noma'lum — alohida to'lang (1)")).toBeVisible()

    // To'lov amallar ro'yxatida — reja kategoriyasi bilan.
    await page.goto(`/h/${householdId}/transactions`)
    await expect(page.getByRole('table', { name: 'Amallar' }).getByRole('row')).toHaveCount(2)
  })
})
