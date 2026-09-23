import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { accessToken, HOUSEHOLD_URL, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { insert, rpc, select, uniqueEmail } from './support/supabase.ts'

/** Byudjet vaqt zonasi (standart) — "joriy oy" sahifadagi bilan bir xil. */
const TIMEZONE = 'Asia/Tashkent'

test.describe('E25: vositalar', () => {
  test.use({ storageState: SIGNED_OUT })

  test("yangi byudjet: ogohlantirish va amal havolasi; ma'lumot bo'limi", async ({ page }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('health'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''

    await page.goto(`/h/${householdId}/health`)
    await expect(page.getByRole('heading', { level: 1, name: 'Tekshiruv' })).toBeVisible()

    // Yangi byudjetda doimiy reja yo'q — ogohlantirish va unga mos havola.
    await expect(page.getByText(/Aktiv doimiy reja yo'q/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Doimiy rejalar' }).first()).toBeVisible()

    // Ma'lumot bo'limi: daromad turlari shablondan.
    await expect(page.getByText('Daromad turlari')).toBeVisible()
    await expect(page.getByText(/Oylik/).first()).toBeVisible()

    await page.getByRole('button', { name: 'Qayta tekshirish' }).click()
    await expect(page.getByText(/Aktiv doimiy reja yo'q/)).toBeVisible()
  })

  test('E25-T02: to‘liq zaxira JSON va rejalar CSV yuklab olinadi', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('export'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''

    await page.goto(`/h/${householdId}/export`)
    const backup = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Zaxirani yuklab olish' }).click()
    const file = await backup
    expect(file.suggestedFilename()).toMatch(/^shaxsiy-byudjet-\d{4}-\d{2}\.json$/)
    const json = JSON.parse(await readFile(await file.path(), 'utf8')) as {
      accounts: unknown[]
      categories: unknown[]
      members: unknown[]
    }
    // Yangi byudjet shabloni: hisoblar, kategoriyalar va bitta a'zo.
    expect(json.accounts.length).toBeGreaterThan(0)
    expect(json.categories.length).toBeGreaterThan(0)
    expect(json.members).toHaveLength(1)

    const plans = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Rejalarni yuklab olish' }).click()
    expect((await plans).suggestedFilename()).toMatch(/^rejalar-.*\.csv$/)
  })

  test('E25-T03: CSV import — tekshiruv, keyin yozuv', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('import'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''

    // Joriy oy — amal ro'yxatining standart filtri.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
    const date = `${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)}`

    await page.goto(`/h/${householdId}/import`)
    await page.getByLabel('CSV fayl').setInputFiles({
      name: 'kochirma.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'Sana;Summa;Joy;Kategoriya;Hisob',
          `${date};-25 000;Makro;Oziq-ovqat;Naqd`,
          `${date};-30 000;Bozor;Yo'q kategoriya;Naqd`,
        ].join('\n'),
      ),
    })

    // Tekshiruvda hech narsa yozilmaydi: bir qator tayyor, biri — xato.
    await page.getByRole('button', { name: 'Tekshirish (yozilmaydi)' }).click()
    await expect(page.getByText('Tayyor: 1')).toBeVisible()
    await expect(page.getByText('Kategoriya topilmadi')).toBeVisible()

    await page.getByRole('button', { name: 'Import qilish' }).click()
    await expect(page.getByText('1 ta amal import qilindi')).toBeVisible()

    await page.goto(`/h/${householdId}/transactions`)
    await expect(page.getByRole('cell', { name: 'Makro', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Bozor', exact: true })).toHaveCount(0)
  })

  test('E25-T04: daromad oyi qoidasi o‘zgargach — yozuvlar ro‘yxati va qayta joylash', async ({
    page,
  }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('recalc'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
    const token = await accessToken(page)

    // "Oylik" (siljish −1) bo'yicha daromad — tegishli oyni trigger qo'yadi.
    const [accounts, categories] = await Promise.all([
      select<{ id: string; type: string }[]>(
        token,
        `accounts?select=id,type&household_id=eq.${householdId}&type=eq.card`,
      ),
      select<{ id: string }[]>(
        token,
        `categories?select=id&household_id=eq.${householdId}&name=eq.Oylik`,
      ),
    ])
    await insert(token, 'transactions', [
      {
        household_id: householdId,
        kind: 'income',
        account_id: accounts[0]?.id,
        category_id: categories[0]?.id,
        amount: 800000000,
        payee: 'Ish joyi',
        occurred_on: new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date()),
      },
    ])

    // Siljishni o'zgartirish — shu yerda darhol taklif qilinadi (BR-043).
    await page.goto(`/h/${householdId}/categories`)
    await page.getByRole('tab', { name: 'Daromad' }).click()
    await page.getByRole('button', { name: 'Oylik: amallar', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Tahrirlash' }).click()
    const form = page.getByRole('dialog')
    await form.getByRole('combobox', { name: 'Qaysi oyga tegishli' }).click()
    await page.getByRole('option', { name: 'Joriy oy (kelgan oyi)' }).click()
    await form.getByRole('button', { name: 'Saqlash' }).click()
    await page.getByRole('button', { name: 'Keyinroq' }).click()

    // Vositalar sahifasi: aynan qaysi yozuv qaysi oyga ko'chishi.
    await page.goto(`/h/${householdId}/recalc`)
    const row = page.getByRole('row', { name: /Ish joyi/ })
    await expect(row).toContainText('Oylik')
    await expect(row).toContainText('→')

    await page.getByRole('button', { name: 'Qayta joylash' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Qayta joylash' }).click()
    await expect(page.getByText('1 ta amal qayta joylandi')).toBeVisible()
    await expect(page.getByText("Ko'chadigan amal yo'q — hammasi joyida.")).toBeVisible()
  })

  test('E25-T05: audit jurnali — farq va jadval filtri', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('audit'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
    await insert(await accessToken(page), 'tags', [
      { household_id: householdId, name: 'E2E audit' },
    ])

    await page.goto(`/h/${householdId}/audit`)
    const row = page.getByRole('row', { name: /Teglar/ }).first()
    await expect(row).toContainText("Qo'shildi")
    await row.getByRole('button', { name: 'Farqini ochish' }).click()
    await expect(page.getByText('E2E audit')).toBeVisible()

    // Jadval filtri serverda: faqat teg yozuvlari qoladi.
    await page.getByRole('button', { name: /Jadval/ }).click()
    await page.getByRole('option', { name: 'Teglar', exact: true }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('cell', { name: 'Teglar' })).toHaveCount(1)
    await expect(page.getByRole('cell', { name: 'Hisoblar' })).toHaveCount(0)
  })

  test('E25-T06: bildirishnomalar — sozlama, sinov natijasi va hisobot arxivi', async ({
    page,
  }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('notify'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
    const token = await accessToken(page)

    // O'tgan oyda daromad — hisobot yakuni bo'sh bo'lmasin.
    const [accounts, categories] = await Promise.all([
      select<{ id: string }[]>(
        token,
        `accounts?select=id&household_id=eq.${householdId}&type=eq.card`,
      ),
      select<{ id: string }[]>(
        token,
        `categories?select=id&household_id=eq.${householdId}&name=eq.Avans`,
      ),
    ])
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
    const previous = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
    previous.setUTCMonth(previous.getUTCMonth() - 1)
    const previousMonth = previous.toISOString().slice(0, 7)
    await insert(token, 'transactions', [
      {
        household_id: householdId,
        kind: 'income',
        account_id: accounts[0]?.id,
        category_id: categories[0]?.id,
        amount: 900000000,
        occurred_on: `${previousMonth}-10`,
      },
    ])

    await page.goto(`/h/${householdId}/notifications`)
    await expect(page.getByRole('heading', { level: 1, name: 'Bildirishnomalar' })).toBeVisible()

    // Telegram ulanmagan — kanal o'chiq; sozlama darhol saqlanadi.
    await expect(page.getByRole('switch', { name: 'Telegram' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await page.getByRole('switch', { name: 'Daromad kelmadi' }).click()
    await expect(page.getByText('Saqlandi')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('switch', { name: 'Daromad kelmadi' })).toHaveAttribute(
      'aria-checked',
      'false',
    )

    // BR-164: sinov xabari — har kanal uchun sabab ko'rinadi.
    await page.getByRole('button', { name: 'Sinov xabari' }).click()
    await expect(page.getByText("Push: qurilma yo'q")).toBeVisible()
    await expect(page.getByText('Telegram: ulanmagan')).toBeVisible()

    // Ulash havolasi va QR (lokalda bot nomi — MyWalletLocalBot).
    await page.getByRole('button', { name: 'Ulash' }).click()
    await expect(page.getByRole('link', { name: /t\.me\/MyWalletLocalBot\?start=/ })).toBeVisible()
    await expect(
      page.getByRole('img', { name: 'Telegram botiga ulash havolasi (QR)' }),
    ).toBeVisible()

    // "Hozir yuborish": hisobot yaratiladi va arxivda ko'rinadi (BR-167).
    await page.getByRole('button', { name: 'Hisobotni hozir yuborish' }).click()
    await expect(page.getByText("daromad 9 000 000 so'm", { exact: false })).toBeVisible()
    await expect(page.getByRole('table', { name: 'Oylik hisobotlar arxivi' })).toContainText(
      '9 000 000',
    )
  })

  test('E25-T07: qurilmalar va sinxron jurnali', async ({ page }) => {
    await page.goto('/login')
    await signIn(page, uniqueEmail('devices'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const householdId = new URL(page.url()).pathname.split('/').at(-1) ?? ''
    const token = await accessToken(page)

    await rpc(token, 'register_device', {
      p_token: 'e2e-device-token-0123456789',
      p_platform: 'android',
      p_app_version: '1.4.2',
    })
    // Rad etiladigan mutatsiya: sinxronda `months` o'zgartirilmaydi.
    // `mutation_id` — har safar yangi: sync_push idempotent (bir marta yoziladi).
    await rpc(token, 'sync_push', {
      p_household: householdId,
      p_device: 'e2e-phone',
      p_mutations: [
        {
          mutation_id: crypto.randomUUID(),
          table: 'months',
          op: 'upsert',
          id: crypto.randomUUID(),
        },
      ],
    })

    await page.goto(`/h/${householdId}/devices`)
    const devices = page.getByRole('table', { name: 'Qurilmalar' })
    await expect(devices).toContainText('android')
    await expect(devices).toContainText('1.4.2')
    await expect(page.getByRole('table', { name: 'Sinxron holati' })).toContainText('e2e-phone')

    const journal = page.getByRole('table', { name: "To'qnashuv va rad etish jurnali" })
    await expect(journal).toContainText('Rad etildi')
    await expect(journal).toContainText("Noto'g'ri mutatsiya")
  })
})
