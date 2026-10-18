// Tutti gli importi sono interi in centesimi: niente numeri decimali nei calcoli.
export const MAX_CENTS = 100_000_000_000_000

const GROUPED = /^\d{1,3}(\.\d{3})*(,\d{1,2})?$/ // 1.234,56 oppure 12,5 oppure 100
const PLAIN = /^\d+([.,]\d{1,2})?$/ // 1234.56 oppure 1234,5

/** Converte un testo digitato dall'utente in centesimi, oppure null se non è valido. */
export function parseAmountToCents(input: string): number | null {
  const s = input.trim().replace(/\s/g, '')
  let normalized: string
  if (GROUPED.test(s)) normalized = s.replace(/\./g, '').replace(',', '.')
  else if (PLAIN.test(s)) normalized = s.replace(',', '.')
  else return null
  const [whole, frac = ''] = normalized.split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null
  return cents
}

export function formatCents(cents: number, currency = 'EUR', locale = 'it-IT'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}
