import type { SupabaseClient } from '@supabase/supabase-js'
import { friendlyError } from './errors'
import { getSupabase } from './supabase'
import type {
  AccountBalance,
  AccountType,
  Category,
  CategoryKind,
  NewTransaction,
  Transaction,
} from './types'

const TX_COLUMNS =
  'id, account_id, type, amount_cents, occurred_on, category_id, transfer_account_id, note'

async function unwrap<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  let result
  try {
    result = await query
  } catch (e) {
    throw new Error(friendlyError(e instanceof Error ? e.message : String(e)))
  }
  if (result.error) throw new Error(friendlyError(result.error.message))
  return result.data as T
}

// user_id non viene mai inviato dal frontend: lo imposta il database da auth.uid().
export function createApi(client: () => SupabaseClient) {
  return {
    listAccountBalances: (): Promise<AccountBalance[]> =>
      unwrap(client().from('account_balances').select('*').order('name')),

    createAccount: async (input: {
      name: string
      type: AccountType
      currency: string
      initial_balance_cents: number
    }): Promise<void> => {
      await unwrap(client().from('accounts').insert(input))
    },

    setAccountArchived: async (id: string, archived: boolean): Promise<void> => {
      await unwrap(client().from('accounts').update({ archived }).eq('id', id))
    },

    listCategories: (): Promise<Category[]> =>
      unwrap(client().from('categories').select('id, name, kind, color').order('name')),

    createCategory: async (input: { name: string; kind: CategoryKind }): Promise<void> => {
      await unwrap(client().from('categories').insert(input))
    },

    deleteCategory: async (id: string): Promise<void> => {
      await unwrap(client().from('categories').delete().eq('id', id))
    },

    createDefaultCategories: async (): Promise<void> => {
      await unwrap(client().rpc('create_default_categories'))
    },

    listTransactions: (limit = 100): Promise<Transaction[]> =>
      unwrap(
        client()
          .from('transactions')
          .select(TX_COLUMNS)
          .order('occurred_on', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit),
      ),

    listTransactionsBetween: (start: string, next: string): Promise<Transaction[]> =>
      unwrap(
        client().from('transactions').select(TX_COLUMNS).gte('occurred_on', start).lt('occurred_on', next),
      ),

    createTransaction: async (input: NewTransaction): Promise<void> => {
      await unwrap(client().from('transactions').insert(input))
    },

    deleteTransaction: async (id: string): Promise<void> => {
      await unwrap(client().from('transactions').delete().eq('id', id))
    },
  }
}

const api = createApi(getSupabase)

export const {
  listAccountBalances,
  createAccount,
  setAccountArchived,
  listCategories,
  createCategory,
  deleteCategory,
  createDefaultCategories,
  listTransactions,
  listTransactionsBetween,
  createTransaction,
  deleteTransaction,
} = api
