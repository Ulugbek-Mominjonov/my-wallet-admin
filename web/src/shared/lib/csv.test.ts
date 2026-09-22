import { describe, expect, it } from 'vitest'

import { toCsv } from '@/shared/lib/csv'

describe('toCsv', () => {
  it('BOM, CRLF; vergul, qo‘shtirnoq va qator uzilishi qo‘shtirnoqda', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          ['x, y', 'u "v"'],
          ['1\n2', null],
        ],
      ),
    ).toBe('﻿a,b\r\n"x, y","u ""v"""\r\n"1\n2",\r\n')
  })

  it('formula bo‘lib ishlashi mumkin bo‘lgan matn zararsizlanadi, raqamlar o‘zgarmaydi', () => {
    expect(
      toCsv(
        ['t', 'n'],
        [
          ['=HYPERLINK("x")', -500],
          ['@cmd', 12.5],
        ],
      ),
    ).toBe('﻿t,n\r\n"\'=HYPERLINK(""x"")",-500\r\n\'@cmd,12.5\r\n')
  })
})
