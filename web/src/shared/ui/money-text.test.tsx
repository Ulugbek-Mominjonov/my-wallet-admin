import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { setLocale } from '@/shared/i18n'
import { renderWithProviders } from '@/shared/test/render'
import { MoneyText } from '@/shared/ui/money-text'

// Testing Library DOM matnidagi NBSP'ni oddiy bo'shliqqa normallashtiradi —
// shuning uchun bu yerda foydalanuvchi ko'radigan matn oddiy bo'shliq bilan.
// NBSP va minus belgisining o'zi formatMoney unit testlarida tekshiriladi.
const MINUS = '−'

describe('MoneyText', () => {
  it("UZS summani so'mda, tabular raqamlar bilan chiqaradi", () => {
    renderWithProviders(<MoneyText amount={123_456_700} />)
    expect(screen.getByText("1 234 567 so'm")).toHaveClass('tabular-nums')
  })

  it('tone=auto: manfiy qoldiq qizil, musbati yashil (BR-091)', () => {
    renderWithProviders(
      <>
        <MoneyText amount={-100} tone="auto" />
        <MoneyText amount={100} tone="auto" />
      </>,
    )
    expect(screen.getByText(`${MINUS}1 so'm`)).toHaveClass('text-expense')
    expect(screen.getByText("1 so'm")).toHaveClass('text-income')
  })

  it("UI tili almashganda valyuta qo'shimchasi ham almashadi", () => {
    renderWithProviders(<MoneyText amount={100_00} />)
    act(() => {
      setLocale('ru')
    })
    expect(screen.getByText('100 сум')).toBeInTheDocument()
  })
})
