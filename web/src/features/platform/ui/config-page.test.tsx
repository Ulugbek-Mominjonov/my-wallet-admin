import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { PlatformConfigPage } from '@/features/platform/ui/config-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'
import { Toaster } from '@/shared/ui/sonner'

const CONFIG = [
  { key: 'maintenance', value: null },
  { key: 'min_android_version', value: '1.0.0' },
  { key: 'telegram_quick_add', value: true },
]

const writes: unknown[] = []

function renderPage() {
  server.use(
    http.get(supabasePath('/rest/v1/app_config'), () => HttpResponse.json(CONFIG)),
    http.post(supabasePath('/rest/v1/app_config'), async ({ request }) => {
      writes.push(await request.json())
      return new HttpResponse(null, { status: 201 })
    }),
  )
  renderWithProviders(
    <>
      <PlatformConfigPage />
      <Toaster />
    </>,
  )
  return userEvent.setup()
}

describe('PlatformConfigPage (E26-T02, BR-214)', () => {
  beforeEach(() => {
    signInTestUser()
    writes.length = 0
  })

  it('minimal versiya: noto‘g‘ri ko‘rinish saqlanmaydi', async () => {
    const user = renderPage()
    const input = await screen.findByLabelText('Minimal Android versiyasi')
    expect(input).toHaveValue('1.0.0')

    await user.clear(input)
    await user.type(input, '1.5')
    expect(screen.getByText(/Versiya .X\.Y\.Z./)).toBeInTheDocument()

    await user.type(input, '.0')
    await user.click(screen.getByRole('button', { name: 'Minimal versiyani saqlash' }))
    expect(await screen.findByText('Konfiguratsiya saqlandi')).toBeInTheDocument()
    expect(writes).toEqual([{ key: 'min_android_version', value: '1.5.0' }])
  })

  it('texnik ishlar banneri uch tilda yoziladi', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('switch', { name: 'Banner yoqilgan' }))
    await user.type(screen.getByLabelText("Nomi (o'zbekcha)"), 'Texnik ishlar')
    await user.type(screen.getByLabelText('Nomi (ruscha)'), 'Техработы')
    await user.type(screen.getByLabelText('Nomi (inglizcha)'), 'Maintenance')

    await user.click(screen.getByRole('button', { name: 'Bannerni saqlash' }))
    expect(writes).toEqual([
      {
        key: 'maintenance',
        value: { message: { uz: 'Texnik ishlar', ru: 'Техработы', en: 'Maintenance' } },
      },
    ])
  })

  it('flag qiymati JSON bo‘lishi kerak', async () => {
    const user = renderPage()
    const flag = await screen.findByLabelText('telegram_quick_add qiymati')
    expect(flag).toHaveValue('true')

    await user.clear(flag)
    await user.type(flag, 'ha')
    await user.tab()
    expect(await screen.findByText(/JSON bo'lishi kerak/)).toBeInTheDocument()
    expect(writes).toEqual([])
  })
})
