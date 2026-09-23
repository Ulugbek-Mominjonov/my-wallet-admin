import { describe, expect, it } from 'vitest'

import { parseCsv, toCsv } from '@/shared/lib/csv'

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

describe('parseCsv', () => {
  it('qo‘shtirnoq ichidagi vergul, qo‘shtirnoq va qator uzilishi', () => {
    expect(parseCsv('a,b\r\n"x, y","u ""v"""\r\n"ikki\nqator",z\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'u "v"'],
      ['ikki\nqator', 'z'],
    ])
  })

  it('nuqtali vergul va tabulyatsiya; BOM olib tashlanadi', () => {
    expect(parseCsv('﻿a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('bo‘sh qatorlar tashlanadi', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
})
