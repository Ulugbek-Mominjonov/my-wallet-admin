import { readFile } from 'node:fs/promises'

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

  test('E24-T02: oylik hisobot — yakun, daromad turlari, kategoriyalar; oy URL da', async ({
    page,
  }, testInfo) => {
    const householdId = await ownerWithData(page)
    await page.goto(`/h/${householdId}/report`)

    // Hisobot tablari — yon menyudagi bir xil nomli havolalardan ajratib.
    const tabs = page.getByRole('navigation', { name: 'Oylik hisobot' })
    const summary = page.getByRole('heading', { name: 'Yakun' })
    await expect(summary).toBeVisible()
    await expect(page.getByRole('table', { name: 'Daromad turlari' })).toContainText('JAMI')
    await expect(page.getByRole('table', { name: 'Kategoriyalar va limitlar' })).toContainText(
      'Oziq-ovqat',
    )
    await expect(page.getByRole('table', { name: "⏳ To'lanmagan rejalar" })).toContainText(
      'Internet',
    )

    if (testInfo.project.name === 'desktop') {
      await page.screenshot({ path: testInfo.outputPath('report.png'), fullPage: true })
    }

    // E24-T06: CSV eksport — yakun va kategoriyalar bitta faylda.
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV eksport' }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(/^hisobot-\d{4}-\d{2}\.csv$/)
    const csv = await readFile(await download.path(), 'utf8')
    expect(csv).toContain('Yakun')
    expect(csv).toContain('Oziq-ovqat')

    // Chop etishda faqat hisobot qoladi (BR-180 uchun print uslublari).
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('link', { name: 'Hisoblar' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Chop etish' })).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Yakun' })).toBeVisible()
    await page.emulateMedia({ media: 'screen' })

    // Oy almashtirish — URL da (ulashiladigan havola).
    await page.getByRole('button', { name: 'Oldingi oy' }).click()
    await expect(page).toHaveURL(/month=\d{4}-\d{2}/)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Yakun' })).toBeVisible()

    // E24-T03: yillik ko'rinish — jadval (JAMI) va grafik.
    await tabs.getByRole('link', { name: 'Yillik' }).click()
    await expect(page).toHaveURL(/\/report\/year/)
    const yearTable = page.getByRole('table', { name: 'Yillik ko‘rinish' })
    await expect(yearTable.getByRole('row', { name: /JAMI/ })).toContainText("8 000 000 so'm")
    await expect(page.getByRole('figure', { name: 'Daromad, xarajat va orttirish' })).toBeVisible()

    // E24-T04: jamg'arma, 👤 fond va hisoblar qoldig'i.
    await tabs.getByRole('link', { name: 'Jamg‘arma' }).click()
    await expect(page).toHaveURL(/\/report\/savings/)
    await expect(page.getByRole('table', { name: 'Jamg‘arma' })).toContainText('⏳')
    const balances = page.getByRole('table', { name: 'Hisoblar qoldig‘i' })
    await expect(balances).toContainText('Naqd')
    await expect(balances.getByRole('row', { name: /JAMI/ })).toBeVisible()

    // E24-T05: kategoriya tahlili — trend va solishtirish jadvali.
    await tabs.getByRole('link', { name: 'Kategoriyalar' }).click()
    await expect(page).toHaveURL(/\/report\/categories/)
    const trend = page.getByRole('table', { name: 'Kategoriya tahlili' })
    await expect(trend).toContainText('Oziq-ovqat')
    await trend.getByRole('button', { name: 'Oziq-ovqat' }).click()
    await expect(page).toHaveURL(/category=/)
    await expect(page.getByRole('link', { name: 'Amallarni ko‘rish' })).toBeVisible()

    // E24-T04: qarz va maqsadlar (bu byudjetda — bo'sh holatlar).
    await tabs.getByRole('link', { name: 'Qarz va maqsad' }).click()
    await expect(page).toHaveURL(/\/report\/obligations/)
    await expect(page.getByText("Qarz yo'q")).toBeVisible()
    await expect(page.getByText("Maqsad yo'q")).toBeVisible()
  })

  test('E24-T07: amal qo‘shilsa hisobot yangilanadi (kesh eskiradi)', async ({ page }) => {
    const householdId = await ownerWithData(page)

    // Hisobot bir marta o'qiladi (staleTime 60 s — kesh to'ladi).
    await page.goto(`/h/${householdId}/report`)
    // "Yakun" kartasi — shu summa prognozda ham uchraydi.
    const summary = page.locator('[data-slot="card"]', {
      has: page.getByRole('heading', { name: 'Yakun' }),
    })
    await expect(summary).toBeVisible()
    await expect(summary.getByText("300 000 so'm")).toBeVisible()

    // Yangi xarajat — amallar sahifasidan.
    await page.goto(`/h/${householdId}/transactions`)
    await page.getByRole('button', { name: "Amal qo'shish" }).click()
    const dialog = page.getByRole('dialog', { name: 'Yangi amal' })
    await dialog.getByLabel('Summa (UZS)').fill('50 000')
    await dialog.getByRole('combobox', { name: 'Hisob' }).click()
    await page.getByRole('option', { name: 'Naqd' }).click()
    await dialog.getByRole('combobox', { name: 'Kategoriya' }).click()
    await page.getByRole('option', { name: 'Oziq-ovqat' }).click()
    await dialog.getByRole('button', { name: 'Saqlash' }).click()
    await expect(dialog).toBeHidden()

    // Hisobot yangi summani ko'rsatadi (eski kesh ishlatilmaydi).
    await page.goto(`/h/${householdId}/report`)
    await expect(summary).toBeVisible()
    await expect(summary.getByText("350 000 so'm")).toBeVisible()
    await expect(summary.getByText("300 000 so'm")).toBeHidden()
  })
})
