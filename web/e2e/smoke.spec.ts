import { expect, test } from '@playwright/test'

import { HOUSEHOLD_URL } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'

test.describe('kirmagan foydalanuvchi', { tag: '@public' }, () => {
  test.use({ storageState: SIGNED_OUT })

  test('kirish sahifasi ochiladi (SPA deep-link)', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Boshqaruv paneliga kirish')).toBeVisible()
  })

  test('ichki sahifa — kirishga, kerakli manzil eslab qolinadi', async ({ page }) => {
    await page.goto('/welcome')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fwelcome$/)
  })
})

test.describe('admin panel karkasi', () => {
  test('bosh sahifa: byudjetga yo‘naltiradi, xulosa va bo‘sh holat', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    await expect(page.getByRole('heading', { level: 1, name: 'Xulosa' })).toBeVisible()
    // Ma'lumotsiz byudjetda ham ko'rsatkichlar (nol bilan) chiqadi (E24-T01).
    await expect(page.getByText('Qoldiq')).toBeVisible()
    await expect(page.getByText('Kuniga sarflash mumkin')).toBeVisible()
  })

  test("noma'lum manzil — 404 sahifasi va bosh sahifaga qaytish", async ({ page }) => {
    await page.goto('/mavjud-emas')
    await expect(page.getByText('Sahifa topilmadi')).toBeVisible()
    await page.getByRole('link', { name: 'Bosh sahifaga' }).click()
    await expect(page).toHaveURL(HOUSEHOLD_URL)
  })

  test('til almashtirish ruscha sarlavhani beradi va eslab qolinadi', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Til' }).click()
    await page.getByRole('menuitemradio', { name: 'Русский' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Сводка' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Сводка' })).toBeVisible()
  })

  test("qorong'i mavzu qo'llanadi va qayta yuklashda saqlanadi", async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Mavzu' }).click()
    await page.getByRole('menuitemradio', { name: "Qorong'i" }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('Ctrl+K palitrasi ochiladi va buyruqni bajaradi', async ({ page, isMobile }) => {
    test.skip(isMobile, 'klaviatura yorlig‘i — desktop uchun')
    await page.goto('/')
    // Ilova chizilib, klaviatura listener'i ulanishini kutamiz.
    await expect(page.getByRole('heading', { level: 1, name: 'Xulosa' })).toBeVisible()
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder('Sahifa yoki buyruq nomini yozing…').fill('rus')
    // Filtr natijasi tanlanguncha kutamiz — aks holda Enter oldingi elementga tushadi.
    await expect(dialog.getByRole('option', { name: 'Русский' })).toHaveAttribute(
      'data-selected',
      'true',
    )
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('heading', { level: 1, name: 'Сводка' })).toBeVisible()
  })
})
