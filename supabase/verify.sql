-- Verifica dello stato del database DOPO la migrazione.
-- Tutte le righe devono avere ok = true.
select 'tabelle presenti' as controllo,
  (select count(*) = 3 from information_schema.tables
    where table_schema = 'public' and table_name in ('accounts', 'categories', 'transactions')) as ok
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
  not (has_table_privilege('anon', 'public.accounts', 'select')
    or has_table_privilege('anon', 'public.categories', 'select')
    or has_table_privilege('anon', 'public.transactions', 'select')
    or has_table_privilege('anon', 'public.account_balances', 'select'))
union all
select 'vista saldi con security_invoker',
  coalesce((select 'security_invoker=true' = any (reloptions)
    from pg_class where oid = 'public.account_balances'::regclass), false);
