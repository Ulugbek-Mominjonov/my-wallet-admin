import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { PlatformHealthPage } from '@/features/platform/ui/health-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const MB = 1024 * 1024

const HEALTH = {
  stats: {
    db_bytes: 380 * MB,
    db_limit_pct: 76,
    storage_bytes: 100 * MB,
    storage_limit_pct: 9.8,
    users: 42,
    households: 51,
    largest_tables: [{ table: 'transactions', bytes: 120 * MB, rows: 250000 }],
  },
  limits: { db_bytes: 500 * MB, storage_bytes: 1024 * MB, warn_pct: 70 },
  jobs: [
    {
      job: 'purge',
      started_at: '2026-09-23T03:00:00Z',
      finished_at: '2026-09-23T03:00:02Z',
      status: 'ok',
      details: { audit_log: 12 },
    },
    {
      job: 'dispatch_notifications',
      started_at: '2026-09-23T04:00:00Z',
      finished_at: '2026-09-23T04:00:01Z',
      status: 'failed',
      details: { error: 'fcm_unavailable' },
    },
  ],
  outbox: { pending: 3, sending: 0, failed: 1, sent: 120, oldest_pending: '2026-09-23T05:00:00Z' },
}

function renderPage() {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/platform_health'), () => HttpResponse.json(HEALTH)),
  )
  renderWithProviders(<PlatformHealthPage />)
}

describe('PlatformHealthPage (E26-T05)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('chegaralar: 70% dan oshgan baza ogohlantiriladi', async () => {
    renderPage()
    expect(await screen.findByText('380 MB / 500 MB (76%)')).toBeInTheDocument()
    const bars = screen.getAllByRole('progressbar')
    expect(bars[0]?.querySelector('.bg-warning')).not.toBeNull()
    expect(bars[1]?.querySelector('.bg-primary')).not.toBeNull()
  })

  it('rejali ishlar: davomiylik va xato sababi', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'Rejali ishlar' })
    expect(table).toHaveTextContent('2.0 s')
    expect(table).toHaveTextContent('fcm_unavailable')
    expect(table).toHaveTextContent('Xato')
  })

  it('navbat va eng katta jadvallar', async () => {
    renderPage()
    expect(await screen.findByText('Navbatda: 3')).toBeInTheDocument()
    expect(screen.getByText('Xato: 1')).toBeInTheDocument()
    const tables = screen.getByRole('table', { name: 'Eng katta jadvallar' })
    expect(tables).toHaveTextContent('transactions')
    expect(tables).toHaveTextContent('120 MB')
  })
})
