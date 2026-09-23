import { expect, test, type Page } from '@playwright/test'

import { accessToken, HOUSEHOLD_URL, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { insert, select, uniqueEmail } from './support/supabase.ts'

/** Yangi foydalanuvchi va 3 ta doimiy reja (oyning 1-kuni) — oyni ochish shulardan. */
async function ownerWithRules(page: Page): Promise<string> {
  await page.goto('/login')
  await signIn(page, uniqueEmail('month'))
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
  const token = await accessToken(page)
  const [accounts, categories] = await Promise.all([
    select<{ id: string; type: string }[]>(
      token,
      `accounts?select=id,type&household_id=eq.${householdId}`,
    ),
    select<{ id: string }[]>(
      token,
      // Nomi reja nomlari bilan to'qnashmaydigan kategoriya.
      `categories?select=id&household_id=eq.${householdId}&name=eq.Oziq-ovqat`,
    ),
  ])
  const rule = {
    household_id: householdId,
    kind: 'expense',
    account_id: accounts.find((a) => a.type === 'cash')?.id,
    category_id: categories[0]?.id,
    day_of_month: 1,
  }
  await insert(token, 'recurring_rules', [
    { ...rule, name: 'Ijara', amount: 30000000 },
    { ...rule, name: 'Internet', amount: 15000000 },
    { ...rule, name: 'Kommunal', amount: 20000000 },
  ])
  return householdId
}

test.describe('E23-T06: oy oqimi', () => {
  test.use({ storageState: SIGNED_OUT })

  test("oyni ochish → to'liq va qisman to'lash → ommaviy → amallarda aks etadi; o'tgan oyni yopish", async ({
    page,
  }) => {
    const householdId = await ownerWithRules(page)
    await page.goto(`/h/${householdId}/plans`)
    await expect(page.getByText("Bu oyda reja yo'q")).toBeVisible()

    // BR-084: preview → tasdiq.
    await page.getByRole('button', { name: 'Oyni ochish' }).click()
    const preview = page.getByRole('dialog', { name: /oyni ochish$/ })
    for (const name of ['Ijara', 'Internet', 'Kommunal']) {
      await expect(preview.getByText(name, { exact: true })).toBeVisible()
    }
    await preview.getByRole('button', { name: 'Ochish' }).click()
    await expect(page.getByText(/ta qo'shildi, 0 ta allaqachon bor edi/)).toBeVisible()

    const row = (name: string) => page.getByRole('row', { name: new RegExp(name) })

    // To'liq to'lov — standart summa qolgani.
    await row('Ijara').getByRole('button', { name: "To'landi" }).click()
    let dialog = page.getByRole('dialog', { name: "«Ijara» — to'lov" })
    await dialog.getByRole('button', { name: "To'landi" }).click()
    await expect(page.getByRole('region', { name: /^To'langan/ })).toContainText('Ijara')

    // Qisman to'lov (BR-073) — reja ochiq qoladi.
    await row('Internet').getByRole('button', { name: "To'landi" }).click()
    dialog = page.getByRole('dialog', { name: "«Internet» — to'lov" })
    await dialog.getByLabel('Summa (UZS)').fill('100 000')
    await expect(dialog.getByLabel("Qisman — qolganini keyin to'layman")).toBeChecked()
    await dialog.getByRole('button', { name: "To'landi" }).click()
    await expect(dialog).toBeHidden()
    await expect(row('Internet')).toContainText("100 000 so'm")

    // Ommaviy (BR-074): Internet qoldig'i va Kommunal.
    await page.getByRole('checkbox', { name: 'Tanlash: Internet' }).check()
    await page.getByRole('checkbox', { name: 'Tanlash: Kommunal' }).check()
    await page
      .getByRole('region', { name: 'Tanlangan: 2' })
      .getByRole('button', { name: "Tanlanganlarni to'lash" })
      .click()
    await page
      .getByRole('dialog', { name: "Tanlangan rejalarni to'lash" })
      .getByRole('button', { name: "Tanlanganlarni to'lash" })
      .click()
    await expect(page.getByText("To'landi: 2 ta reja")).toBeVisible()
    const paid = page.getByRole('region', { name: /^To'langan/ })
    await expect(paid).toContainText('Internet')
    await expect(paid).toContainText('Kommunal')

    // To'lovlar amallarda: 300 000 + 100 000 + 50 000 + 200 000.
    await page.goto(`/h/${householdId}/transactions`)
    await expect(page.getByRole('table', { name: 'Amallar' }).getByRole('row')).toHaveCount(5)
    await expect(page.getByRole('region', { name: "Filtr bo'yicha jami" })).toContainText(
      "650 000 so'm",
    )

    // O'tgan oy: ochish → yopish (tekshiruv ogohlantirishi bilan) → qayta ochish.
    await page.goto(`/h/${householdId}/plans`)
    await page.getByRole('button', { name: 'Oldingi oy' }).click()
    await page.getByRole('button', { name: 'Oyni ochish' }).click()
    await page
      .getByRole('dialog', { name: /oyni ochish$/ })
      .getByRole('button', { name: 'Ochish' })
      .click()
    await page.getByRole('button', { name: 'Oyni yopish' }).click()
    const close = page.getByRole('dialog', { name: /oyni yopish$/ })
    await expect(close.getByRole('status')).toContainText("To'lanmagan rejalar: 3 ta")
    await close.getByRole('button', { name: 'Baribir yopish' }).click()
    await expect(page.getByText('Yopilgan', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Oyni ochish' })).toBeHidden()

    await page.getByRole('button', { name: 'Qayta ochish' }).click()
    await page
      .getByRole('dialog', { name: /qayta ochilsinmi\?$/ })
      .getByRole('button', { name: 'Qayta ochish' })
      .click()
    await expect(page.getByText('Yopilgan', { exact: true })).toBeHidden()
  })
})
