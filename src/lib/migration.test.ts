// Analisi statica della migrazione: controlla che nessuna tabella sia rimasta senza RLS
// o con policy troppo permissive. Non sostituisce il test SQL su Supabase.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('../../supabase/migrations/20261017000000_init_personal_finance.sql', import.meta.url),
  'utf8',
).replace(/--.*$/gm, '')

const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1])

describe('migrazione SQL (analisi statica)', () => {
  it('crea le tre tabelle attese', () => {
    expect(tables.sort()).toEqual(['accounts', 'categories', 'transactions'])
  })

  it.each(tables)('la tabella %s ha RLS attiva e quattro policy', (table) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`))
    for (const op of ['select', 'insert', 'update', 'delete']) {
      expect(sql).toMatch(new RegExp(`create policy ${table}_${op} on public\\.${table} for ${op} to authenticated`))
    }
  })

  it('nessuna policy è aperta a tutti o al ruolo anon', () => {
    const policies = sql.match(/create policy[\s\S]*?;/g) ?? []
    expect(policies.length).toBe(tables.length * 4)
    for (const p of policies) {
      expect(p).not.toMatch(/\bto anon\b|\bto public\b/)
      expect(p).not.toMatch(/(using|with check)\s*\(\s*true\s*\)/)
      expect(p).toMatch(/user_id = \(select auth\.uid\(\)\)/)
    }
  })

  it('i permessi di anon vengono revocati e la vista rispetta l\'RLS', () => {
    expect(sql).toMatch(/revoke all on public\.accounts[\s\S]*from anon, authenticated, public/)
    expect(sql).toMatch(/create view public\.account_balances with \(security_invoker = true\)/)
    expect(sql).not.toMatch(/grant [^;]*\bto anon\b/)
  })

  it('un conto con movimenti si elimina solo dentro una cascata (cancellazione utente)', () => {
    expect(sql).toMatch(/create trigger accounts_guard_delete before delete on public\.accounts/)
    expect(sql).toMatch(/pg_trigger_depth\(\) = 1/)
    expect(sql).toMatch(/transactions_account_fk[\s\S]*?on delete cascade/)
  })

  it('gli importi sono interi positivi in centesimi', () => {
    expect(sql).toMatch(/amount_cents bigint not null/)
    expect(sql).toMatch(/transactions_amount_range check \(amount_cents between 1 and/)
  })

  it('i collegamenti tra tabelle usano chiavi composite con user_id', () => {
    expect(sql).toMatch(/foreign key \(account_id, user_id\) references public\.accounts \(id, user_id\)/)
    expect(sql).toMatch(/foreign key \(transfer_account_id, user_id\) references public\.accounts/)
    expect(sql).toMatch(/foreign key \(category_id, user_id\) references public\.categories/)
  })
})
