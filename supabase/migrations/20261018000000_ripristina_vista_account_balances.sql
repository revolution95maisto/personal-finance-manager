-- =====================================================================
-- NUOVA MIGRAZIONE 20261018000000 (non modifica la migrazione iniziale).
-- Ripristina SOLO la vista public.account_balances, i suoi permessi e la cache dell'API.
-- Sicura da rieseguire. Da usare se le tabelle accounts/categories/transactions esistono
-- ma la vista manca (vedi 00_diagnosi_account_balances.sql).
-- Se mancano anche le tabelle, esegui invece la migrazione iniziale.
-- =====================================================================

do $$
begin
  if to_regclass('public.accounts') is null
     or to_regclass('public.categories') is null
     or to_regclass('public.transactions') is null then
    raise exception 'Mancano le tabelle: esegui prima la migrazione iniziale 20261017000000_init_personal_finance.sql (questo file ripristina solo la vista).';
  end if;
end $$;

-- account_balances è una VISTA (i saldi non sono salvati: si calcolano dai movimenti).
-- security_invoker = true: la vista applica l'RLS dell'utente che la interroga.
create or replace view public.account_balances with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.currency,
  a.archived,
  a.initial_balance_cents,
  (a.initial_balance_cents + coalesce(sum(
    case
      when t.transfer_account_id = a.id then t.amount_cents
      when t.type = 'income' then t.amount_cents
      else -t.amount_cents
    end
  ), 0))::bigint as balance_cents
from public.accounts a
left join public.transactions t
  on t.user_id = a.user_id
 and (t.account_id = a.id or t.transfer_account_id = a.id)
group by a.id;

-- Stessi permessi della migrazione iniziale: nessun accesso ad anon, sola lettura ad authenticated.
revoke all on public.account_balances from anon, authenticated, public;
grant select on public.account_balances to authenticated;

-- Controllo finale: se qualcosa non torna, lo script si ferma con un errore chiaro.
do $$
begin
  if to_regclass('public.account_balances') is null then
    raise exception 'Controllo fallito: la vista account_balances non esiste';
  end if;
  if has_table_privilege('anon', 'public.account_balances', 'select') then
    raise exception 'Controllo fallito: il ruolo anon non deve poter leggere account_balances';
  end if;
  if not has_table_privilege('authenticated', 'public.account_balances', 'select') then
    raise exception 'Controllo fallito: authenticated deve poter leggere account_balances';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = to_regclass('public.account_balances') and 'security_invoker=true' = any (reloptions)
  ) then
    raise exception 'Controllo fallito: la vista deve avere security_invoker = true';
  end if;
end $$;

-- Chiede a PostgREST (l'API di Supabase) di rileggere lo schema.
notify pgrst, 'reload schema';
