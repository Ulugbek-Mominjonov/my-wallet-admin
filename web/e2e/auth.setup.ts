import { expect, test as setup } from '@playwright/test'

import { HOUSEHOLD_URL, signIn } from './support/app.ts'
import { OWNER_STATE } from './support/state.ts'
import { uniqueEmail } from './support/supabase.ts'

/** Bir marta kirib, sessiyani saqlaydi — karkas testlari shu holatdan boshlanadi. */
setup('owner sessiyasi', async ({ page }) => {
  await page.goto('/login')
  await signIn(page, uniqueEmail('owner'))
  await expect(page).toHaveURL(HOUSEHOLD_URL)
  await page.context().storageState({ path: OWNER_STATE })
})
