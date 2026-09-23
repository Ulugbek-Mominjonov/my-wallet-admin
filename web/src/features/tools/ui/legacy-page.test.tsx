import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { LegacyImportPage } from '@/features/tools/ui/legacy-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const PAYLOAD = JSON.stringify({
  version: 1,
  incomes: [{}, {}],
  expenses: [{}],
  expectedMonths: [{ monthKey: '2026-08' }],
})

const month = (diff: number) => ({
  month: '2026-08-01',
  legacy: { balance: 480000000, saved: 540000000 },
  current: { balance: 480000000 + diff, saved: 540000000 },
  diff: { balance: diff, saved: 0 },
})

const result = (dryRun: boolean, diff: number) => ({
  batch: '0198f000-0000-7000-8000-0000000000b1',
  dry_run: dryRun,
  counts: { incomes: 2, expenses: 1, plans: 1, allocations: 0, fund_spends: 0 },
  warnings: diff === 0 ? [] : [{ code: 'debt_not_found', name: 'Hamkor bank' }],
  months: [month(diff)],
})

const calls: { p_dry_run: boolean }[] = []

function renderPage(diff = 0) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/import_legacy_v1'), async ({ request }) => {
      const body = (await request.json()) as { p_dry_run: boolean }
      calls.push(body)
      return HttpResponse.json(result(body.p_dry_run, diff))
    }),
  )
  renderWithProviders(
    <WithHousehold>
      <LegacyImportPage householdId={TEST_HOUSEHOLD_ID} baseCurrency="UZS" />
    </WithHousehold>,
  )
  return userEvent.setup()
}

const upload = (user: ReturnType<typeof userEvent.setup>, text = PAYLOAD) =>
  user.upload(
    screen.getByLabelText('Eksport fayli (JSON)'),
    new File([text], 'export.json', { type: 'application/json' }),
  )

describe('LegacyImportPage (E27-T04, BR-181)', () => {
  beforeEach(() => {
    signInTestUser()
    calls.length = 0
  })

  it('farq 0 bo‘lsa import ochiladi', async () => {
    const user = renderPage(0)
    await upload(user)
    expect(await screen.findByText('Daromad: 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tekshirish (yozilmaydi)' }))
    expect(await screen.findByText(/Hamma oy bo‘yicha farq yo‘q/)).toBeInTheDocument()
    expect(calls.map((call) => call.p_dry_run)).toEqual([true])

    await user.click(screen.getByRole('button', { name: 'Import qilish' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Import qilish' }))
    expect(await screen.findByText(/Ko'chirildi: 3 ta amal/)).toBeInTheDocument()
    expect(calls.map((call) => call.p_dry_run)).toEqual([true, false])
  })

  it('farq bo‘lsa import yopiq qoladi', async () => {
    const user = renderPage(50000)
    await upload(user)
    await user.click(screen.getByRole('button', { name: 'Tekshirish (yozilmaydi)' }))

    expect(await screen.findByText(/Farq bor/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import qilish' })).toBeDisabled()
    expect(screen.getByText(/Qarz topilmadi: Hamkor bank/)).toBeInTheDocument()
  })

  it('boshqa versiyadagi fayl rad etiladi', async () => {
    const user = renderPage()
    await upload(user, '{"version": 2}')
    expect(await screen.findByText('Fayl versiyasi mos emas (v1 kerak)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tekshirish (yozilmaydi)' })).toBeDisabled()
  })
})
