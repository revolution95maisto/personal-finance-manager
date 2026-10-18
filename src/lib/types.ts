export type AccountType = 'cash' | 'checking' | 'savings' | 'credit_card' | 'investment' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryKind = 'income' | 'expense'

export interface AccountBalance {
  account_id: string
  name: string
  type: AccountType
  currency: string
  archived: boolean
  initial_balance_cents: number
  balance_cents: number
}

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  color: string | null
}

export interface Transaction {
  id: string
  account_id: string
  type: TransactionType
  amount_cents: number
  occurred_on: string
  category_id: string | null
  transfer_account_id: string | null
  note: string | null
}

export interface NewTransaction {
  account_id: string
  type: TransactionType
  amount_cents: number
  occurred_on: string
  category_id: string | null
  transfer_account_id: string | null
  note: string | null
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Contanti',
  checking: 'Conto corrente',
  savings: 'Risparmio',
  credit_card: 'Carta di credito',
  investment: 'Investimenti',
  other: 'Altro',
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Uscita',
  income: 'Entrata',
  transfer: 'Giroconto',
}
