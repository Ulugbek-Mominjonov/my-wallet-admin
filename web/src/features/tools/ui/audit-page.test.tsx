import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { AUDIT_PAGE_SIZE } from '@/features/tools/api/audit-api'
import { AuditPage } from '@/features/tools/ui/audit-page'
import { server, signInTestUser, supabasePath, TEST_USER_ID } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const MEMBERS = [{ value: TEST_USER_ID, label: 'Ali' }]

const ENTRY = {
  id: 2,
  at: '2026-09-23T09:30:00Z',
  actor_id: TEST_USER_ID,
  table_name: 'tags',
  record_id: '0198f000-0000-7000-8000-00000000000a',
  action: 'update',
  old_values: { name: 'Bozor' },
  new_values: { name: 'Bozorlik' },
}

interface Args {
  p_tables?: string[]
  p_from?: string
  p_after_id?: number
}

const calls: Args[] = []

function renderPage(pages: (typeof ENTRY)[][] = [[ENTRY]]) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/audit_list'), async ({ request }) => {
      const args = (await request.json()) as Args
      calls.push(args)
      return HttpResponse.json(args.p_after_id === undefined ? (pages[0] ?? []) : (pages[1] ?? []))
    }),
  )
  renderWithProviders(
    <WithHousehold>
      <AuditPage householdId={TEST_HOUSEHOLD_ID} members={MEMBERS} />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('AuditPage (E25-T05, BR-008)', () => {
  beforeEach(() => {
    signInTestUser()
    calls.length = 0
  })

  it('yozuv: kim, nima, amal; farqi ochiladi', async () => {
    const user = renderPage()
    expect(await screen.findByText('Ali')).toBeInTheDocument()
    expect(screen.getByText('Teglar')).toBeInTheDocument()
    expect(screen.getByText("O'zgardi")).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Farqini ochish' }))
    expect(screen.getByText('name')).toBeInTheDocument()
    expect(screen.getByText('Bozor')).toBeInTheDocument()
    expect(screen.getByText('Bozorlik')).toBeInTheDocument()
  })

  it('jadval filtri serverga boradi', async () => {
    const user = renderPage()
    await screen.findByText('Ali')
    await user.click(screen.getByRole('button', { name: /Jadval/ }))
    await user.click(await screen.findByRole('option', { name: 'Amallar' }))
    await screen.findByText('Ali')
    expect(calls.at(-1)?.p_tables).toEqual(['transactions'])
  })

  it('sahifa to‘lsa — "Yana yuklash" keyset bilan', async () => {
    const full = Array.from({ length: AUDIT_PAGE_SIZE }, (_, index) => ({
      ...ENTRY,
      id: 100 - index,
    }))
    const user = renderPage([full, [{ ...ENTRY, id: 1, table_name: 'accounts' }]])
    await user.click(await screen.findByRole('button', { name: 'Yana yuklash' }))
    expect(await screen.findByText('Hisoblar')).toBeInTheDocument()
    expect(calls.at(-1)?.p_after_id).toBe(100 - (AUDIT_PAGE_SIZE - 1))
  })

  it('bo‘sh jurnal — bo‘sh holat', async () => {
    renderPage([[]])
    expect(await screen.findByText('Jurnal bo‘sh')).toBeInTheDocument()
  })
})
