import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Role } from '@/entities/household'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { ExportPage } from '@/features/tools/ui/export-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}))

const PLANS = [
  {
    kind: 'expense',
    name: 'Ijara',
    budget_month: '2026-09-01',
    due_date: '2026-09-05',
    planned_amount: 30000000,
    paid_amount: 30000000,
    settled_at: '2026-09-05T00:00:00Z',
    skipped_at: null,
    category_id: null,
  },
  {
    kind: 'expense',
    name: 'Svet',
    budget_month: '2026-09-01',
    due_date: '2026-09-10',
    planned_amount: null,
    paid_amount: 0,
    settled_at: null,
    skipped_at: null,
    category_id: null,
  },
]

const files: { name: string; text: Promise<string> }[] = []

function renderPage(role: Role = 'owner') {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/export_household'), () =>
      HttpResponse.json({ version: 1, transactions: [{ id: 't1' }] }),
    ),
    http.get(supabasePath('/rest/v1/planned_items'), () => HttpResponse.json(PLANS)),
  )
  renderWithProviders(
    <WithHousehold memberRole={role}>
      <ExportPage
        householdId={TEST_HOUSEHOLD_ID}
        householdName="Oila byudjeti"
        currentMonth="2026-09"
      />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('ExportPage (E25-T02)', () => {
  beforeEach(() => {
    signInTestUser()
    files.length = 0
    const blobs = new Map<string, Blob>()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => {
        const url = `blob:test/${String(blobs.size)}`
        blobs.set(url, blob)
        return url
      },
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      const blob = blobs.get(this.href)
      if (blob) files.push({ name: this.download, text: blob.text() })
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('to‘liq zaxira JSON fayl bo‘lib yuklanadi', async () => {
    const user = renderPage()
    await user.click(screen.getByRole('button', { name: 'Zaxirani yuklab olish' }))
    expect(await screen.findByText('Zaxira tayyor')).toBeInTheDocument()
    expect(files[0]?.name).toBe('oila-byudjeti-2026-09.json')
    expect(await files[0]?.text).toContain('"transactions"')
  })

  it('rejalar CSV: summalar asosiy birlikda, holat kodi bilan', async () => {
    const user = renderPage()
    await user.click(screen.getByRole('button', { name: 'Rejalarni yuklab olish' }))
    expect(await screen.findByText('2 ta reja')).toBeInTheDocument()
    expect(files[0]?.name).toBe('rejalar-2025-10_2026-09.csv')
    const csv = (await files[0]?.text) ?? ''
    expect(csv).toContain('Ijara,2026-09,2026-09-05,300000,300000,paid')
    // Summasi noma'lum reja — bo'sh katak.
    expect(csv).toContain('Svet,2026-09,2026-09-10,,0,open')
  })

  it('member to‘liq zaxira ololmaydi', () => {
    renderPage('member')
    expect(screen.queryByRole('button', { name: 'Zaxirani yuklab olish' })).toBeNull()
    expect(screen.getByText("To'liq zaxirani faqat egasi yoki admin oladi")).toBeInTheDocument()
  })
})
