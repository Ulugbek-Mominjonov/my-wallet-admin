import { mkdir } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { accessToken, HOUSEHOLD_URL, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { insert, rpc, select, uniqueEmail } from './support/supabase.ts'

/**
 * E28-T05: qo'llanma uchun skrinshotlar (`docs/img/`). Odatdagi test emas —
 * faqat `make docs-shots` da ishlaydi: ma'lumot to'qiladi va sahifalar
 * suratga olinadi. Ma'lumot sintetik (lokal baza) — shaxsiy hech nima yo'q.
 */
const ENABLED = process.env.DOCS_SHOTS === '1'
const SHOTS = '../docs/img'
const TIMEZONE = 'Asia/Tashkent'

test.describe('qo‘llanma skrinshotlari', () => {
  test.use({ storageState: SIGNED_OUT, viewport: { width: 1280, height: 860 } })
  test.skip(!ENABLED, 'Faqat `make docs-shots`')

  test('@docs admin panel sahifalari', async ({ page }) => {
    await mkdir(SHOTS, { recursive: true })
    await page.goto('/login')
    await signIn(page, uniqueEmail('docs'))
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
        `categories?select=id,name&household_id=eq.${householdId}`,
      ),
    ])
    const account = (type: string) => accounts.find((a) => a.type === type)?.id
    const category = (name: string) => categories.find((c) => c.name === name)?.id
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
    const month = `${today.slice(0, 7)}-01`
    const base = { household_id: householdId, occurred_on: today, budget_month: month }

    // Oy ochiladi (doimiy rejalardan), so'ng bir necha amal yoziladi.
    await rpc(token, 'open_month', { p_household: householdId, p_month: month })
    await insert(token, 'transactions', [
      {
        ...base,
        kind: 'income',
        account_id: account('card'),
        category_id: category('Avans'),
        amount: 900000000,
        payee: null,
      },
      {
        ...base,
        kind: 'expense',
        account_id: account('cash'),
        category_id: category('Oziq-ovqat'),
        amount: 32000000,
        payee: 'Korzinka',
      },
      {
        ...base,
        kind: 'expense',
        account_id: account('card'),
        category_id: category('Transport'),
        amount: 8500000,
        payee: 'Yandex Go',
      },
      {
        ...base,
        kind: 'expense',
        account_id: account('card'),
        category_id: category("Ko'ngilochar") ?? category('Boshqa'),
        amount: 12000000,
        payee: 'Kinoteatr',
      },
    ])

    const shot = async (path: string, name: string, heading: string) => {
      await page.goto(`/h/${householdId}${path}`)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      // Grafik va jadvallar to'liq chizilsin.
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
    }

    await shot('', 'admin-xulosa', 'Xulosa')
    await shot('/transactions', 'admin-amallar', 'Amallar')
    await shot('/plans', 'admin-rejalar', 'Rejalar')
    await shot('/report', 'admin-hisobot', 'Oylik hisobot')
    await shot('/notifications', 'admin-bildirishnomalar', 'Bildirishnomalar')
    await shot('/health', 'admin-tekshiruv', 'Tekshiruv')
  })
})
