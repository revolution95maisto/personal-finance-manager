import { describe, expect, it } from 'vitest'
import { computeBalances, monthKey, monthlyTotals, monthRange, signedAmountForAccount } from './balance'

const accounts = [
  { id: 'a1', initial_balance_cents: 100000 },
  { id: 'a2', initial_balance_cents: 0 },
  { id: 'a3', initial_balance_cents: 0 },
]

const txs = [
  { account_id: 'a1', type: 'income' as const, amount_cents: 50000, transfer_account_id: null, occurred_on: '2026-10-01' },
  { account_id: 'a1', type: 'expense' as const, amount_cents: 12050, transfer_account_id: null, occurred_on: '2026-10-02' },
  { account_id: 'a1', type: 'transfer' as const, amount_cents: 20000, transfer_account_id: 'a2', occurred_on: '2026-10-03' },
]

describe('saldi dei conti (stesso esempio del test SQL)', () => {
  it('calcola 117950 / 20000 / 0', () => {
    const b = computeBalances(accounts, txs)
    expect(b.get('a1')).toBe(117950)
    expect(b.get('a2')).toBe(20000)
    expect(b.get('a3')).toBe(0)
  })

  it('un giroconto sposta denaro senza crearne né distruggerne', () => {
    const b = computeBalances(accounts, [txs[2]])
    expect((b.get('a1') ?? 0) + (b.get('a2') ?? 0)).toBe(100000)
  })

  it('un movimento non tocca i conti estranei', () => {
    expect(signedAmountForAccount(txs[0], 'a2')).toBe(0)
  })
})

describe('totali mensili', () => {
  const currencies = new Map([['a1', 'EUR'], ['a2', 'EUR']])

  it('esclude i giroconti e separa le valute', () => {
    const totals = monthlyTotals(txs, currencies, '2026-10')
    expect(totals).toEqual({ EUR: { income: 50000, expense: 12050 } })
  })

  it('ignora i movimenti di altri mesi', () => {
    expect(monthlyTotals(txs, currencies, '2026-09')).toEqual({})
  })

  it('calcola chiavi e intervallo del mese, anche a dicembre', () => {
    expect(monthKey(new Date(2026, 9, 17))).toBe('2026-10')
    expect(monthRange(new Date(2026, 11, 5))).toEqual({ start: '2026-12-01', next: '2027-01-01' })
  })
})
