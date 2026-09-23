import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { DevicesPage } from '@/features/tools/ui/devices-page'
import { server, signInTestUser, supabasePath, TEST_USER_ID } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const MEMBERS = [{ value: TEST_USER_ID, label: 'Ali' }]

const DEVICES = {
  devices: [
    {
      user_id: TEST_USER_ID,
      platform: 'android',
      app_version: '1.2.3',
      last_seen_at: '2026-09-23T06:00:00Z',
    },
  ],
  sync: [
    {
      user_id: TEST_USER_ID,
      device_id: 'ali-phone',
      last_sync_at: '2026-09-23T06:00:10Z',
      ok: 12,
      conflicts: 1,
      rejected: 2,
    },
  ],
}

const ENTRY = {
  mutation_id: '0198f000-0000-7000-8000-0000000000e1',
  user_id: TEST_USER_ID,
  device_id: 'ali-phone',
  table_name: 'transactions',
  record_id: '0198f000-0000-7000-8000-0000000000a1',
  status: 'rejected',
  code: 'month_closed',
  applied_at: '2026-09-23T06:00:09Z',
}

const requests: string[] = []

function renderPage(rows: (typeof ENTRY)[] = [ENTRY]) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/household_devices'), () => HttpResponse.json(DEVICES)),
    http.get(supabasePath('/rest/v1/sync_mutations'), ({ request }) => {
      requests.push(new URL(request.url).search)
      return HttpResponse.json(rows)
    }),
  )
  renderWithProviders(
    <WithHousehold>
      <DevicesPage householdId={TEST_HOUSEHOLD_ID} members={MEMBERS} />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('DevicesPage (E25-T07)', () => {
  beforeEach(() => {
    signInTestUser()
    requests.length = 0
  })

  it('qurilma va sinxron holati: versiya, oxirgi sinxron, sonlar', async () => {
    renderPage()
    const list = await screen.findByRole('table', { name: 'Qurilmalar' })
    expect(list).toHaveTextContent('Ali')
    expect(list).toHaveTextContent('android')
    expect(list).toHaveTextContent('1.2.3')

    const sync = screen.getByRole('table', { name: 'Sinxron holati' })
    expect(sync).toHaveTextContent('ali-phone')
    expect(sync).toHaveTextContent('12')
  })

  it('jurnal standart holatda faqat muammolarni so‘raydi, sababi bilan', async () => {
    renderPage()
    expect(await screen.findByText('Oy yopilgan')).toBeInTheDocument()
    expect(screen.getByText('Rad etildi')).toBeInTheDocument()
    // `result` to'liq tortilmaydi — faqat sabab kodi.
    expect(requests[0]).toContain('status=in.%28conflict%2Crejected%29')
    expect(requests[0]).toContain('code%3Aresult-%3E%3Ecode')
  })

  it('holat filtri so‘rovni o‘zgartiradi', async () => {
    const user = renderPage()
    await screen.findByText('Oy yopilgan')
    await user.click(screen.getByRole('button', { name: /Holati/ }))
    await user.click(await screen.findByRole('option', { name: 'Qabul qilindi' }))
    await screen.findByText('Oy yopilgan')
    expect(requests.at(-1)).toContain('status=in.%28conflict%2Crejected%2Cok%29')
  })

  it('jurnal bo‘sh bo‘lsa — tushunarli matn', async () => {
    renderPage([])
    expect(await screen.findByText('Bu filtr bo‘yicha yozuv yo‘q')).toBeInTheDocument()
  })
})
