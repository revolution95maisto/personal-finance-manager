import type { Transaction } from './types'

type TxLike = Pick<Transaction, 'account_id' | 'type' | 'amount_cents' | 'transfer_account_id'>

/** Effetto di un movimento sul saldo di un conto (stessa regola della vista SQL account_balances). */
export function signedAmountForAccount(tx: TxLike, accountId: string): number {
  if (tx.transfer_account_id === accountId) return tx.amount_cents
  if (tx.account_id !== accountId) return 0
  return tx.type === 'income' ? tx.amount_cents : -tx.amount_cents
}

export function computeBalances(
  accounts: { id: string; initial_balance_cents: number }[],
  txs: TxLike[],
): Map<string, number> {
  const balances = new Map<string, number>()
  for (const a of accounts) {
    balances.set(
      a.id,
      txs.reduce((sum, t) => sum + signedAmountForAccount(t, a.id), a.initial_balance_cents),
    )
  }
  return balances
}

export interface CurrencyTotals {
  income: number
  expense: number
}

/** Entrate e uscite del mese per valuta. I giroconti non sono né entrate né uscite. */
export function monthlyTotals(
  txs: Pick<Transaction, 'account_id' | 'type' | 'amount_cents' | 'occurred_on'>[],
  currencyByAccount: Map<string, string>,
  month: string, // formato YYYY-MM
): Record<string, CurrencyTotals> {
  const totals: Record<string, CurrencyTotals> = {}
  for (const t of txs) {
    if (t.type === 'transfer' || !t.occurred_on.startsWith(month)) continue
    const currency = currencyByAccount.get(t.account_id)
    if (!currency) continue
    const entry = (totals[currency] ??= { income: 0, expense: 0 })
    if (t.type === 'income') entry.income += t.amount_cents
    else entry.expense += t.amount_cents
  }
  return totals
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthRange(d: Date): { start: string; next: string } {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return { start: `${monthKey(d)}-01`, next: `${monthKey(next)}-01` }
}

export function todayIso(): string {
  const d = new Date()
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`
}
