import { expect, type Page } from '@playwright/test'

import { emailCode, mailIds } from './supabase.ts'

/** Byudjet sahifasi manzili (`/h/<uuid>`). */
export const HOUSEHOLD_URL = /\/h\/[0-9a-f-]{36}$/

/** Kirish sahifasi orqali (email → Mailpit'dagi kod). */
export async function signIn(page: Page, email: string): Promise<void> {
  const seen = await mailIds(email)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Kod olish' }).click()
  await page.getByLabel('Kod').fill(await emailCode(email, seen))
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

/** GoTrue `max_frequency` (supabase/config.toml): bir email'ga kod oralig'i. */
const OTP_COOLDOWN_MS = 31_000

/** Shu email'ga oldingi kod [sentAt] da yuborilgan — cheklov tugaguncha kutadi. */
export async function waitForOtpCooldown(page: Page, sentAt: number): Promise<void> {
  const left = sentAt + OTP_COOLDOWN_MS - Date.now()
  if (left > 0) await page.waitForTimeout(left)
}

/** Topbar'dagi hisob menyusidan band tanlash. */
export async function openAccountMenuItem(page: Page, item: string): Promise<void> {
  await page.getByRole('button', { name: 'Hisob' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** Brauzerdagi Supabase sessiyasi tokeni — shu foydalanuvchi nomidan ma'lumot tayyorlash uchun. */
export async function accessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    )
    const raw = key === undefined ? null : localStorage.getItem(key)
    return raw === null ? null : (JSON.parse(raw) as { access_token?: string }).access_token
  })
  if (!token) throw new Error('Brauzerda Supabase sessiyasi topilmadi')
  return token
}
