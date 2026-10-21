-- Verifica dello stato del database DOPO la migrazione.
-- Tutte le righe devono avere ok = true.
select 'tabelle e vista saldi presenti' as controllo,
  ((select count(*) = 3 from information_schema.tables
    where table_schema = 'public' and table_name in ('accounts', 'categories', 'transactions'))
   and to_regclass('public.account_balances') is not null) as ok
union all
select 'RLS attiva su tutte le tabelle',
  (select count(*) = 3 from pg_tables
    where schemaname = 'public' and tablename in ('accounts', 'categories', 'transactions') and rowsecurity)
union all
select 'quattro policy per tabella',
  (select count(*) = 3 from (
    select tablename from pg_policies where schemaname = 'public'
    group by tablename having count(*) = 4) s)
union all
select 'ruolo anon senza accesso ai dati',
  case when to_regclass('public.account_balances') is null then false
  else not (has_table_privilege('anon', 'public.accounts', 'select')
    or has_table_privilege('anon', 'public.categories', 'select')
    or has_table_privilege('anon', 'public.transactions', 'select')
    or has_table_privilege('anon', 'public.account_balances', 'select')) end
union all
select 'vista saldi con security_invoker',
  coalesce((select 'security_invoker=true' = any (reloptions)
    from pg_class where oid = to_regclass('public.account_balances')), false);
