import { describe, expect, it } from 'vitest'
import { friendlyError } from './errors'

describe('friendlyError', () => {
  it.each([
    ['duplicate key value violates unique constraint "accounts_user_name_key"', /già un conto/],
    ['duplicate key value violates unique constraint "categories_user_kind_name_key"', /già una categoria/],
    ['new row for relation "transactions" violates check constraint "transactions_amount_range"', /maggiore di zero/],
    ['new row violates row-level security policy for table "accounts"', /non consentita/],
    ['permission denied for table accounts', /non consentita/],
    ['Invalid login credentials', /non corretti/],
    ['Email not confirmed', /Conferma/],
    ['JWT expired', /Sessione scaduta/],
    ['TypeError: Failed to fetch', /Connessione/],
  ])('traduce "%s"', (input, expected) => {
    expect(friendlyError(input)).toMatch(expected)
  })

  it('lascia invariati i messaggi già in italiano e quelli sconosciuti', () => {
    const m = 'I giroconti richiedono due conti con la stessa valuta'
    expect(friendlyError(m)).toBe(m)
    expect(friendlyError('qualcosa di strano')).toBe('qualcosa di strano')
  })
})
