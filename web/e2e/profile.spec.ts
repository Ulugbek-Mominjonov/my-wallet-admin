import { expect, test } from '@playwright/test'

import { HOUSEHOLD_URL, openAccountMenuItem, signIn, waitForOtpCooldown } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { uniqueEmail } from './support/supabase.ts'
import { totp } from './support/totp.ts'

test('profil: ism saqlanadi va qayta yuklashda qoladi', async ({ page, isMobile }) => {
  test.skip(isMobile, 'umumiy owner profili — parallel loyihalar bir-birini yozib yuboradi')
  await page.goto('/')
  await openAccountMenuItem(page, 'Profil va xavfsizlik')
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible()

  const name = `E2E ${String(Date.now())}`
  await page.getByLabel('Ism').fill(name)
  await page.getByRole('button', { name: 'Saqlash' }).click()
  await expect(page.getByText('Profil saqlandi')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Ism')).toHaveValue(name)
})

test.describe('2FA (E21-T04)', () => {
  test.use({ storageState: SIGNED_OUT })

  test('yoqish → chiqish → qayta kirishda kod so‘raladi', async ({ page }) => {
    // Ikki marta email kodi (GoTrue cheklovi 30 s) + TOTP oynalari.
    test.slow()
    const email = uniqueEmail('mfa')

    await page.goto('/login')
    const firstCodeAt = Date.now()
    await signIn(page, email)
    await expect(page).toHaveURL(HOUSEHOLD_URL)

    await openAccountMenuItem(page, 'Profil va xavfsizlik')
    await page.getByRole('button', { name: 'Yoqish' }).click()
    await expect(page.getByRole('img', { name: '2FA sozlash uchun QR kod' })).toBeVisible()
    const secret = (await page.locator('code').textContent()) ?? ''
    await page.getByLabel('Tasdiqlash kodi').fill(totp(secret))
    await page.getByRole('button', { name: 'Tasdiqlash' }).click()
    await expect(page.getByText(/dan beri yoqilgan/)).toBeVisible()
    await expect(page.getByText('Email kodi + 2FA kodi')).toBeVisible()

    await openAccountMenuItem(page, 'Chiqish')
    await expect(page).toHaveURL(/\/login/)

    await waitForOtpCooldown(page, firstCodeAt)
    await signIn(page, email)
    await expect(page.getByText('Ikki bosqichli tekshiruv')).toBeVisible()
    await expect(page).toHaveURL(/\/mfa/)

    await page.getByLabel('Tasdiqlash kodi').fill(totp(secret))
    await page.getByRole('button', { name: 'Tasdiqlash' }).click()
    await expect(page).toHaveURL(HOUSEHOLD_URL)
  })
})
