import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { createApi } from './api'

type Op = [string, unknown[]]
interface Call {
  target: string
  ops: Op[]
}

// Client finto: registra ogni chiamata e risponde con il risultato scelto dal test.
function fakeClient(result: { data: unknown; error: { message: string } | null } = { data: [], error: null }) {
  const calls: Call[] = []
  const chain = (call: Call): unknown => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve(result).then(resolve, reject)
          }
          return (...args: unknown[]) => {
            call.ops.push([prop, args])
            return proxy
          }
        },
      },
    )
    return proxy
  }
  const client = {
    from(table: string) {
      const call: Call = { target: table, ops: [] }
      calls.push(call)
      return chain(call)
    },
    rpc(name: string) {
      const call: Call = { target: `rpc:${name}`, ops: [] }
      calls.push(call)
      return chain(call)
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

const sampleTx = {
  account_id: 'a1',
  type: 'expense' as const,
  amount_cents: 1250,
  occurred_on: '2026-10-18',
  category_id: null,
  transfer_account_id: null,
  note: null,
}

describe('livello dati', () => {
  it('createTransaction invia solo i campi del movimento, mai user_id', async () => {
    const { client, calls } = fakeClient()
    await createApi(() => client).createTransaction(sampleTx)
    expect(calls).toHaveLength(1)
    expect(calls[0].target).toBe('transactions')
    expect(calls[0].ops).toEqual([['insert', [sampleTx]]])
  })

  it('nessuna funzione dell\'API manda user_id al database', async () => {
    const { client, calls } = fakeClient()
    const api = createApi(() => client)
    await api.listAccountBalances()
    await api.createAccount({ name: 'Conto', type: 'checking', currency: 'EUR', initial_balance_cents: 0 })
    await api.setAccountArchived('a1', true)
    await api.listCategories()
    await api.createCategory({ name: 'Casa', kind: 'expense' })
    await api.deleteCategory('c1')
    await api.createDefaultCategories()
    await api.listTransactions(50)
    await api.listTransactionsBetween('2026-10-01', '2026-11-01')
    await api.createTransaction(sampleTx)
    await api.deleteTransaction('t1')
    expect(calls.length).toBe(11)
    expect(JSON.stringify(calls)).not.toContain('user_id')
  })

  it('legge i saldi dalla vista e gli ultimi movimenti con il limite richiesto', async () => {
    const { client, calls } = fakeClient()
    const api = createApi(() => client)
    await api.listAccountBalances()
    await api.listTransactions(30)
    expect(calls[0].target).toBe('account_balances')
    expect(calls[1].ops).toContainEqual(['limit', [30]])
  })

  it('le eliminazioni sono sempre filtrate per id', async () => {
    const { client, calls } = fakeClient()
    const api = createApi(() => client)
    await api.deleteTransaction('t1')
    await api.deleteCategory('c1')
    for (const c of calls) expect(c.ops).toContainEqual(['eq', ['id', c.target === 'transactions' ? 't1' : 'c1']])
  })

  it('le categorie di base passano dalla funzione del database', async () => {
    const { client, calls } = fakeClient()
    await createApi(() => client).createDefaultCategories()
    expect(calls[0].target).toBe('rpc:create_default_categories')
  })

  it('traduce gli errori del database in italiano', async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "accounts_user_name_key"' },
    })
    await expect(
      createApi(() => client).createAccount({ name: 'x', type: 'cash', currency: 'EUR', initial_balance_cents: 0 }),
    ).rejects.toThrow(/già un conto/)
  })
})
