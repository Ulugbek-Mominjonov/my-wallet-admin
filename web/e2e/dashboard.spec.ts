import { expect, test, type Page } from '@playwright/test'

import { accessToken, HOUSEHOLD_URL, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { insert, select, uniqueEmail } from './support/supabase.ts'

const TIMEZONE = 'Asia/Tashkent'

/** Yangi foydalanuvchi: daromad, ikki xarajat va bitta to'lanmagan reja. */
async function ownerWithData(page: Page): Promise<string> {
  await page.goto('/login')
  await signIn(page, uniqueEmail('dash'))
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
  const token = await accessToken(page)
  const [accounts, categories] = await Promise.all([
    select<{ id: string; type: string }[]>(
      token,
      `accounts?select=id,type&household_id=eq.${householdId}`,
    ),
    select<{ id: string; name: string; kind: string }[]>(
      token,
      `categories?select=id,name,kind&household_id=eq.${householdId}`,
    ),
  ])
  const account = (type: string) => accounts.find((a) => a.type === type)?.id
  const category = (name: string) => categories.find((c) => c.name === name)?.id
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
  const month = `${today.slice(0, 7)}-01`
  const base = { household_id: householdId, occurred_on: today, budget_month: month }
  await insert(token, 'transactions', [
    {
      ...base,
      kind: 'income',
      account_id: account('card'),
      // BR-040: "Oylik" oldingi oyga tushadi — joriy oy uchun siljishsiz tur.
      category_id: category('Avans'),
      amount: 800000000,
      payee: null,
    },
    {
      ...base,
      kind: 'expense',
      account_id: account('cash'),
      category_id: category('Oziq-ovqat'),
      amount: 20000000,
      payee: 'Korzinka',
    },
    {
      ...base,
      kind: 'expense',
      account_id: account('card'),
      category_id: category('Transport'),
      amount: 10000000,
      payee: 'Yandex Go',
    },
  ])
  await insert(token, 'planned_items', [
    {
      household_id: householdId,
      kind: 'expense',
      name: 'Internet',
      account_id: account('cash'),
      category_id: category('Aloqa') ?? category('Oziq-ovqat'),
      planned_amount: 15000000,
      due_date: today,
      budget_month: month,
    },
  ])
  return householdId
}

test.describe('E24-T01: xulosa', () => {
  test.use({ storageState: SIGNED_OUT })

  test("ko'rsatkichlar, grafik (jadval ko'rinishi ham), kategoriyalar va yaqin to'lovlar", async ({
    page,
  }, testInfo) => {
    const householdId = await ownerWithData(page)
    await page.goto(`/h/${householdId}`)

    // KPI: qoldiq = 8 000 000 − 300 000.
    await expect(page.getByText('Qoldiq')).toBeVisible()
    await expect(page.getByText("7 700 000 so'm").first()).toBeVisible()
    await expect(page.getByText('Oy oxiri prognozi')).toBeVisible()

    const flow = page.getByRole('figure', { name: 'Daromad va xarajat' })
    await expect(flow.getByRole('img', { name: 'Daromad, Xarajat' })).toBeVisible()
    await flow.getByRole('button', { name: 'Jadval' }).click()
    await expect(flow.getByRole('table', { name: 'Daromad va xarajat' })).toContainText(
      "8 000 000 so'm",
    )
    await flow.getByRole('button', { name: 'Grafik' }).click()

    const top = page.getByRole('figure', { name: 'Ko‘p sarflangan kategoriyalar' })
    await expect(top).toContainText('Oziq-ovqat')
    await expect(top).toContainText('67%')

    await expect(page.getByText('Internet')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ogohlantirishlar' })).toBeVisible()

    if (testInfo.project.name === 'desktop') {
      await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true })
    }
  })
})
