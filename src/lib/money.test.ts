import { describe, expect, it } from 'vitest'
import { formatCents, parseAmountToCents } from './money'

describe('parseAmountToCents', () => {
  it.each([
    ['12,50', 1250],
    ['12.5', 1250],
    ['12,5', 1250],
    ['1.234,56', 123456],
    ['1.234', 123400],
    ['1234.56', 123456],
    ['0,05', 5],
    ['0.50', 50],
    ['100', 10000],
    ['  7 ', 700],
    ['0', 0],
  ])('interpreta "%s" come %i centesimi', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected)
  })

  it.each(['', 'abc', '-5', '1,234', '1.5.5', '12,', ',50', '1e3', '12,505'])(
    'rifiuta "%s"',
    (input) => {
      expect(parseAmountToCents(input)).toBeNull()
    },
  )

  it('rifiuta importi oltre il limite e non perde precisione', () => {
    expect(parseAmountToCents('99999999999999999999')).toBeNull()
    expect(parseAmountToCents('0,10')! + parseAmountToCents('0,20')!).toBe(30)
  })
})

describe('formatCents', () => {
  it('formatta in euro all\'italiana', () => {
    // In italiano i numeri a quattro cifre non hanno il punto delle migliaia: lo usiamo da cinque cifre in su.
    const text = formatCents(12345678, 'EUR').replace(/\s/g, ' ')
    expect(text).toContain('123.456,78')
    expect(text).toContain('€')
  })
})
