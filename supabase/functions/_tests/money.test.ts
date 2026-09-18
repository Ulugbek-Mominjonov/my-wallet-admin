// Admin (web/src/shared/lib/money.test.ts) bilan bir xil holatlar — xabardagi
// summa ekrandagi bilan aynan bir xil ko'rinsin.
import { assertEquals } from '@std/assert'
import { formatMoney, toLocale } from '../_shared/money.ts'

const NBSP = '\u00a0'

Deno.test("UZS: tiyindan so'mga, minglik guruhlari bilan", () => {
  assertEquals(formatMoney(123_456_700), `1${NBSP}234${NBSP}567${NBSP}so'm`)
})

Deno.test("UZS: so'mgacha yaxlitlanadi", () => {
  assertEquals(formatMoney(150), `2${NBSP}so'm`)
})

Deno.test('manfiy summa haqiqiy minus belgisi bilan', () => {
  assertEquals(formatMoney(-50_000), `−500${NBSP}so'm`)
})

Deno.test("tilga qarab UZS qo'shimchasi", () => {
  assertEquals(formatMoney(100_00, 'ru'), `100${NBSP}сум`)
  assertEquals(formatMoney(100_00, 'en'), `100${NBSP}UZS`)
})

Deno.test('boshqa valyutalar — Intl, sent bilan', () => {
  assertEquals(formatMoney(123_45, 'en', 'USD'), '$123.45')
})

Deno.test("noma'lum til — uz", () => {
  assertEquals(toLocale('ru'), 'ru')
  assertEquals(toLocale('de'), 'uz')
  assertEquals(toLocale(null), 'uz')
})
