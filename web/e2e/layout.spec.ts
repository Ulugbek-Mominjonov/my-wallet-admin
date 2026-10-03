/// <reference lib="dom" />
// `tsconfig.node.json` da DOM kutubxonasi yo'q (e2e — Node muhiti), lekin
// `page.evaluate` ichidagi kod brauzerda bajariladi.
import { expect, test } from '@playwright/test'

import { HOUSEHOLD_URL } from './support/app.ts'

/** Sahifadan tashqariga chiqib ketgan elementlar (gorizontal scroll sababi). */
async function overflowing(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth
    const seen: { tag: string; cls: string; right: number }[] = []
    for (const node of document.querySelectorAll<HTMLElement>('body *')) {
      const box = node.getBoundingClientRect()
      if (box.width === 0 || box.right <= limit + 1) continue
      // Faqat eng tashqi aybdor kerak: ota-onasi ham chiqqan bo'lsa tashlaymiz.
      if (node.parentElement && node.parentElement.getBoundingClientRect().right > limit + 1) {
        continue
      }
      seen.push({
        tag: node.tagName.toLowerCase(),
        cls: node.className.slice(0, 80),
        right: Math.round(box.right),
      })
    }
    return { limit, scrollWidth: document.documentElement.scrollWidth, seen }
  })
}

test.describe('sahifa kengligi', () => {
  test('asosiy sahifalarda gorizontal scroll yo‘q', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(HOUSEHOLD_URL)
    const household = new URL(page.url()).pathname

    const paths = [
      household,
      `${household}/transactions`,
      `${household}/report/month`,
      `${household}/accounts`,
      `${household}/categories`,
    ]
    // Keng oynada chiqadigan toshishlar ham ushlansin (1280 da ko'rinmaydi).
    const widths = [1280, 1600, 1920]
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of paths) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        const result = await overflowing(page)
        expect(
          result.scrollWidth,
          `${width}px ${path}: ${result.scrollWidth} > ${result.limit}; aybdorlar: ${JSON.stringify(result.seen)}`,
        ).toBeLessThanOrEqual(result.limit + 1)
      }
    }

    // Oyna kichrayganda ham toshmasligi kerak: `flex-1` elementning standart
    // `min-width: auto` si grafikning eski kengligi bilan sahifani kengaytirardi.
    await page.setViewportSize({ width: 1920, height: 900 })
    await page.goto(household)
    await page.waitForLoadState('networkidle')
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect
      .poll(async () => (await overflowing(page)).scrollWidth, { timeout: 5000 })
      .toBeLessThanOrEqual(1281)
  })
})
