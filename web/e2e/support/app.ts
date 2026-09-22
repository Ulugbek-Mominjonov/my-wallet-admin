import { expect, type Page } from '@playwright/test'

import { emailCode } from './supabase.ts'

/** Byudjet sahifasi manzili (`/h/<uuid>`). */
export const HOUSEHOLD_URL = /\/h\/[0-9a-f-]{36}$/

/** Kirish sahifasi orqali (email → Mailpit'dagi kod). */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Kod olish' }).click()
  await page.getByLabel('Kod').fill(await emailCode(email))
  await page.getByRole('button', { name: 'Kirish' }).click()
}

/** Byudjet almashtirgich (mobilda avval sidebar — drawer — ochiladi). */
export async function openHouseholdSwitcher(
  page: Page,
  isMobile: boolean,
  current: string,
): Promise<void> {
  if (isMobile) await page.getByRole('button', { name: "Menyuni yig'ish/ochish" }).click()
  const trigger = page.getByRole('button', { name: new RegExp(current) })
  await expect(trigger).toBeVisible()
  await trigger.click()
}
