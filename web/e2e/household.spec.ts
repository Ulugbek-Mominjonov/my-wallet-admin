import { expect, test } from '@playwright/test'

import { HOUSEHOLD_URL, openHouseholdSwitcher, signIn } from './support/app.ts'
import { SIGNED_OUT } from './support/state.ts'
import { rpc, signInViaApi, uniqueEmail } from './support/supabase.ts'

const PERSONAL = 'Shaxsiy byudjet'

test.describe('E21: kirish → byudjet tanlash → rolga mos ko‘rinish', () => {
  test.use({ storageState: SIGNED_OUT })

  test('kirgach kutilgan sahifaga qaytadi; yangi foydalanuvchi — o‘z byudjeti egasi', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await signIn(page, uniqueEmail('new'))

    await expect(page).toHaveURL(HOUSEHOLD_URL)
    await expect(page.getByRole('heading', { level: 1, name: 'Xulosa' })).toBeVisible()
    await openHouseholdSwitcher(page, isMobile, PERSONAL)
    await expect(page.getByRole('menuitemradio', { name: /Shaxsiy byudjet\s*Egasi/ })).toBeChecked()
  })

  test('taklif kodi bilan qo‘shilish — viewer faqat ko‘radi, byudjet eslab qolinadi', async ({
    page,
    isMobile,
  }) => {
    // Boshqa foydalanuvchi oilaviy byudjet yaratib, viewer taklifini beradi.
    const owner = await signInViaApi(uniqueEmail('family-owner'))
    const familyId = await rpc<string>(owner, 'create_household', { p_name: 'Oila E2E' })
    const invites = await rpc<{ code: string }[]>(owner, 'create_invite', {
      p_household: familyId,
      p_role: 'viewer',
    })
    const invite = invites.at(0)
    if (!invite) throw new Error('create_invite javobi bo‘sh')

    await page.goto('/login')
    await signIn(page, uniqueEmail('viewer'))
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    await expect(page.getByText("Faqat ko'rish")).toBeHidden()

    await openHouseholdSwitcher(page, isMobile, PERSONAL)
    await page.getByRole('menuitem', { name: 'Yangi byudjet yoki taklif kodi' }).click()
    await page.getByLabel('Taklif kodi').fill(invite.code.toLowerCase())
    await page.getByRole('button', { name: "Qo'shilish" }).click()

    await expect(page).toHaveURL(`/h/${familyId}`)
    await expect(page.getByText("Faqat ko'rish")).toBeVisible()

    // Oxirgi tanlangan byudjet — bosh sahifa shu byudjetni ochadi.
    await page.goto('/')
    await expect(page).toHaveURL(`/h/${familyId}`)

    await openHouseholdSwitcher(page, isMobile, 'Oila E2E')
    await page.getByRole('menuitemradio', { name: new RegExp(PERSONAL) }).click()
    await expect(page).not.toHaveURL(`/h/${familyId}`)
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    await expect(page.getByText("Faqat ko'rish")).toBeHidden()
  })
})

test('a’zo bo‘lmagan byudjet — 403 sahifasi', async ({ page }) => {
  await page.goto('/h/0198f000-0000-7000-8000-000000000000')
  await expect(page.getByText("Ruxsat yo'q")).toBeVisible()
  await page.getByRole('link', { name: 'Bosh sahifaga' }).click()
  await expect(page).toHaveURL(HOUSEHOLD_URL)
})
