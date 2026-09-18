import { expect, test } from '@playwright/test'

test.describe('admin panel karkasi', () => {
  test('bosh sahifa: xulosa sarlavhasi va bo‘sh holat', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Xulosa' })).toBeVisible()
    await expect(page.getByText("Hozircha ma'lumot yo'q")).toBeVisible()
  })

  test('kirish sahifasi ochiladi (SPA deep-link)', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Boshqaruv paneliga kirish')).toBeVisible()
  })

  test("noma'lum manzil — 404 sahifasi va bosh sahifaga qaytish", async ({ page }) => {
    await page.goto('/mavjud-emas')
    await expect(page.getByText('Sahifa topilmadi')).toBeVisible()
    await page.getByRole('link', { name: 'Bosh sahifaga' }).click()
    await expect(page).toHaveURL(/\/$/)
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
