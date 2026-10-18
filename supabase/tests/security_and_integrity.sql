-- =====================================================================
-- Test di sicurezza (RLS) e correttezza dei movimenti.
-- Da eseguire nel SQL Editor DOPO la migrazione.
-- Tutto avviene dentro una transazione annullata con ROLLBACK: non resta
-- nessun dato (neanche i due utenti di prova).
-- Se un test fallisce compare un errore "FAIL [...]": in quel caso esegui
-- da solo il comando  rollback;  e mandami il messaggio.
-- Se invece arrivi in fondo vedi la riga "OK: tutti i test ...".
-- =====================================================================
begin;

-- Funzioni di aiuto, esistono solo dentro questa transazione.
create function public.__t_expect_error(label text, stmt text, expected text[])
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = any (expected) then
      return;
    end if;
    raise exception 'FAIL [%]: errore inatteso % - %', label, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL [%]: l''operazione doveva essere rifiutata', label;
end $$;

create function public.__t_expect_rowcount(label text, stmt text, expected bigint)
returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'FAIL [%]: righe coinvolte % (attese %)', label, n, expected;
  end if;
end $$;

create function public.__t_expect_count(label text, stmt text, expected bigint)
returns void language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || stmt || ') s' into n;
  if n <> expected then
    raise exception 'FAIL [%]: conteggio % (atteso %)', label, n, expected;
  end if;
end $$;

-- Due utenti di prova (A e B).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'test-a@example.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'test-b@example.invalid');

-- ---------------------------------------------------------------
-- 1) Utente anonimo: nessun accesso
-- ---------------------------------------------------------------
set local role anon;
select public.__t_expect_error('anon non legge i conti',
  $q$select * from public.accounts$q$, array['42501']);
select public.__t_expect_error('anon non legge i movimenti',
  $q$select * from public.transactions$q$, array['42501']);
select public.__t_expect_error('anon non scrive i conti',
  $q$insert into public.accounts (name) values ('x')$q$, array['42501']);
select public.__t_expect_error('anon non scrive le categorie',
  $q$insert into public.categories (name, kind) values ('x', 'expense')$q$, array['42501']);
select public.__t_expect_error('anon non scrive i movimenti',
  $q$insert into public.transactions (account_id, type, amount_cents)
     values ('a0000000-0000-0000-0000-000000000001', 'expense', 100)$q$, array['42501']);
select public.__t_expect_error('anon non legge i saldi',
  $q$select * from public.account_balances$q$, array['42501']);
select public.__t_expect_error('anon non chiama create_default_categories',
  $q$select public.create_default_categories()$q$, array['42501']);
reset role;

-- ---------------------------------------------------------------
-- 2) Utente A crea i propri dati
-- ---------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

insert into public.accounts (id, name, type, currency, initial_balance_cents) values
  ('a0000000-0000-0000-0000-000000000001', 'Conto test', 'checking', 'EUR', 100000),
  ('a0000000-0000-0000-0000-000000000002', 'Risparmio test', 'savings', 'EUR', 0),
  ('a0000000-0000-0000-0000-000000000003', 'Conto USD test', 'checking', 'USD', 0);

insert into public.categories (id, name, kind) values
  ('c0000000-0000-0000-0000-000000000001', 'Stipendio test', 'income'),
  ('c0000000-0000-0000-0000-000000000002', 'Spesa test', 'expense');

insert into public.transactions (id, account_id, type, amount_cents, occurred_on, category_id) values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'income', 50000, '2026-10-01', 'c0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'expense', 12050, '2026-10-02', 'c0000000-0000-0000-0000-000000000002');

insert into public.transactions
  (id, account_id, type, amount_cents, occurred_on, transfer_account_id) values
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'transfer', 20000, '2026-10-03', 'a0000000-0000-0000-0000-000000000002');

-- user_id viene impostato in automatico dal database
select public.__t_expect_count('user_id automatico = utente A',
  $q$select 1 from public.transactions where user_id = '11111111-1111-1111-1111-111111111111'$q$, 3);

-- ---------------------------------------------------------------
-- 3) Correttezza dei saldi
--    conto 1: 100000 + 50000 - 12050 - 20000 = 117950
--    conto 2: 0 + 20000 (giroconto in entrata) = 20000
-- ---------------------------------------------------------------
select public.__t_expect_count('saldo conto 1 = 117950',
  $q$select 1 from public.account_balances
     where account_id = 'a0000000-0000-0000-0000-000000000001' and balance_cents = 117950$q$, 1);
select public.__t_expect_count('saldo conto 2 = 20000',
  $q$select 1 from public.account_balances
     where account_id = 'a0000000-0000-0000-0000-000000000002' and balance_cents = 20000$q$, 1);
select public.__t_expect_count('saldo conto senza movimenti = saldo iniziale',
  $q$select 1 from public.account_balances
     where account_id = 'a0000000-0000-0000-0000-000000000003' and balance_cents = 0$q$, 1);

-- ---------------------------------------------------------------
-- 4) Vincoli sui movimenti
-- ---------------------------------------------------------------
select public.__t_expect_error('importo zero rifiutato',
  $q$insert into public.transactions (account_id, type, amount_cents)
     values ('a0000000-0000-0000-0000-000000000001', 'expense', 0)$q$, array['23514']);
select public.__t_expect_error('importo negativo rifiutato',
  $q$insert into public.transactions (account_id, type, amount_cents)
     values ('a0000000-0000-0000-0000-000000000001', 'expense', -500)$q$, array['23514']);
select public.__t_expect_error('giroconto senza destinazione rifiutato',
  $q$insert into public.transactions (account_id, type, amount_cents)
     values ('a0000000-0000-0000-0000-000000000001', 'transfer', 500)$q$, array['23514']);
select public.__t_expect_error('destinazione su un movimento non giroconto rifiutata',
  $q$insert into public.transactions (account_id, type, amount_cents, transfer_account_id)
     values ('a0000000-0000-0000-0000-000000000001', 'expense', 500,
             'a0000000-0000-0000-0000-000000000002')$q$, array['23514']);
select public.__t_expect_error('giroconto sullo stesso conto rifiutato',
  $q$insert into public.transactions (account_id, type, amount_cents, transfer_account_id)
     values ('a0000000-0000-0000-0000-000000000001', 'transfer', 500,
             'a0000000-0000-0000-0000-000000000001')$q$, array['23514']);
select public.__t_expect_error('giroconto con categoria rifiutato',
  $q$insert into public.transactions
       (account_id, type, amount_cents, transfer_account_id, category_id)
     values ('a0000000-0000-0000-0000-000000000001', 'transfer', 500,
             'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002')$q$,
  array['23514']);
select public.__t_expect_error('giroconto tra valute diverse rifiutato',
  $q$insert into public.transactions (account_id, type, amount_cents, transfer_account_id)
     values ('a0000000-0000-0000-0000-000000000001', 'transfer', 500,
             'a0000000-0000-0000-0000-000000000003')$q$, array['23514']);
select public.__t_expect_error('categoria di entrata su una spesa rifiutata',
  $q$insert into public.transactions (account_id, type, amount_cents, category_id)
     values ('a0000000-0000-0000-0000-000000000001', 'expense', 500,
             'c0000000-0000-0000-0000-000000000001')$q$, array['23514']);
select public.__t_expect_error('nota troppo lunga rifiutata',
  $q$insert into public.transactions (account_id, type, amount_cents, note)
     values ('a0000000-0000-0000-0000-000000000001', 'expense', 500, repeat('x', 501))$q$,
  array['23514']);
select public.__t_expect_error('valuta non valida rifiutata',
  $q$insert into public.accounts (name, currency) values ('Valuta errata', 'eur')$q$, array['23514']);
select public.__t_expect_error('nome conto duplicato rifiutato',
  $q$insert into public.accounts (name) values ('Conto test')$q$, array['23505']);

-- Il saldo non deve essere cambiato dai tentativi falliti
select public.__t_expect_count('saldo conto 1 invariato dopo i rifiuti',
  $q$select 1 from public.account_balances
     where account_id = 'a0000000-0000-0000-0000-000000000001' and balance_cents = 117950$q$, 1);

-- 4b) Modifiche di movimenti esistenti: le stesse regole valgono anche in UPDATE
select public.__t_expect_error('data fuori intervallo rifiutata',
  $q$insert into public.transactions (account_id, type, amount_cents, occurred_on)
     values ('a0000000-0000-0000-0000-000000000001', 'expense', 500, '1999-12-31')$q$, array['23514']);
select public.__t_expect_error('importo a zero in modifica rifiutato',
  $q$update public.transactions set amount_cents = 0
     where id = 'f0000000-0000-0000-0000-000000000001'$q$, array['23514']);
select public.__t_expect_error('categoria incoerente in modifica rifiutata',
  $q$update public.transactions set category_id = 'c0000000-0000-0000-0000-000000000002'
     where id = 'f0000000-0000-0000-0000-000000000001'$q$, array['23514']);
select public.__t_expect_error('entrata con categoria trasformata in giroconto rifiutata',
  $q$update public.transactions set type = 'transfer'
     where id = 'f0000000-0000-0000-0000-000000000001'$q$, array['23514']);

-- una modifica valida dell'importo cambia il saldo di conseguenza
update public.transactions set amount_cents = 60000
  where id = 'f0000000-0000-0000-0000-000000000001';
select public.__t_expect_count('saldo dopo aver portato l''entrata a 60000 = 127950',
  $q$select 1 from public.account_balances
     where account_id = 'a0000000-0000-0000-0000-000000000001' and balance_cents = 127950$q$, 1);
update public.transactions set amount_cents = 50000
  where id = 'f0000000-0000-0000-0000-000000000001';
select public.__t_expect_count('saldo ripristinato a 117950',
  $q$select 1 from public.account_balances
     where account_id = 'a0000000-0000-0000-0000-000000000001' and balance_cents = 117950$q$, 1);

-- ---------------------------------------------------------------
-- 5) Integrità dei conti
-- ---------------------------------------------------------------
select public.__t_expect_error('conto con movimenti non eliminabile',
  $q$delete from public.accounts where id = 'a0000000-0000-0000-0000-000000000001'$q$, array['23503']);
select public.__t_expect_error('conto che riceve un giroconto non eliminabile',
  $q$delete from public.accounts where id = 'a0000000-0000-0000-0000-000000000002'$q$, array['23503']);
insert into public.accounts (id, name) values ('a0000000-0000-0000-0000-000000000004', 'Conto vuoto');
select public.__t_expect_rowcount('conto senza movimenti eliminabile',
  $q$delete from public.accounts where id = 'a0000000-0000-0000-0000-000000000004'$q$, 1);
select public.__t_expect_error('valuta non modificabile con movimenti',
  $q$update public.accounts set currency = 'USD'
     where id = 'a0000000-0000-0000-0000-000000000001'$q$, array['23514']);
select public.__t_expect_error('user_id di un movimento non modificabile',
  $q$update public.transactions set user_id = '22222222-2222-2222-2222-222222222222'
     where id = 'f0000000-0000-0000-0000-000000000001'$q$, array['42501']);

-- Conto archiviato: niente nuovi movimenti
update public.accounts set archived = true where id = 'a0000000-0000-0000-0000-000000000003';
select public.__t_expect_error('conto archiviato rifiuta nuovi movimenti',
  $q$insert into public.transactions (account_id, type, amount_cents)
     values ('a0000000-0000-0000-0000-000000000003', 'income', 500)$q$, array['23514']);

-- ---------------------------------------------------------------
-- 6) Categorie di base
-- ---------------------------------------------------------------
select public.__t_expect_count('prima chiamata crea 14 categorie',
  $q$select 1 from (select public.create_default_categories() as n) s where n = 14$q$, 1);
select public.__t_expect_count('seconda chiamata non duplica',
  $q$select 1 from (select public.create_default_categories() as n) s where n = 0$q$, 1);

-- ---------------------------------------------------------------
-- 7) Utente B non vede e non tocca nulla di A
-- ---------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select public.__t_expect_count('B non vede i conti di A',
  $q$select 1 from public.accounts$q$, 0);
select public.__t_expect_count('B non vede le categorie di A',
  $q$select 1 from public.categories$q$, 0);
select public.__t_expect_count('B non vede i movimenti di A',
  $q$select 1 from public.transactions$q$, 0);
select public.__t_expect_count('B non vede i saldi di A',
  $q$select 1 from public.account_balances$q$, 0);

-- B crea dati propri (serviranno per il test di cancellazione dell'utente)
insert into public.accounts (id, name, currency, initial_balance_cents)
  values ('b0000000-0000-0000-0000-000000000003', 'Conto B persistente', 'EUR', 5000);
insert into public.categories (id, name, kind)
  values ('c1000000-0000-0000-0000-000000000001', 'Categoria B', 'expense');
insert into public.transactions (account_id, type, amount_cents, category_id)
  values ('b0000000-0000-0000-0000-000000000003', 'expense', 1000, 'c1000000-0000-0000-0000-000000000001');
select public.__t_expect_count('B vede solo il proprio conto',
  $q$select 1 from public.accounts$q$, 1);
select public.__t_expect_count('il saldo di B è 4000 e non include nulla di A',
  $q$select 1 from public.account_balances where balance_cents = 4000$q$, 1);

select public.__t_expect_error('B non può scrivere categorie a nome di A',
  $q$insert into public.categories (user_id, name, kind)
     values ('11111111-1111-1111-1111-111111111111', 'spoof', 'expense')$q$, array['42501']);
select public.__t_expect_error('B non può scrivere movimenti a nome di A',
  $q$insert into public.transactions (user_id, account_id, type, amount_cents)
     values ('11111111-1111-1111-1111-111111111111',
             'a0000000-0000-0000-0000-000000000001', 'expense', 100)$q$, array['42501']);

select public.__t_expect_rowcount('B non modifica i movimenti di A',
  $q$update public.transactions set note = 'hack'
     where id = 'f0000000-0000-0000-0000-000000000001'$q$, 0);
select public.__t_expect_rowcount('B non elimina i movimenti di A',
  $q$delete from public.transactions where id = 'f0000000-0000-0000-0000-000000000001'$q$, 0);
select public.__t_expect_rowcount('B non modifica i conti di A',
  $q$update public.accounts set name = 'hack'
     where id = 'a0000000-0000-0000-0000-000000000001'$q$, 0);
select public.__t_expect_rowcount('B non elimina i conti di A',
  $q$delete from public.accounts where id = 'a0000000-0000-0000-0000-000000000001'$q$, 0);

select public.__t_expect_error('B non può scrivere a nome di A',
  $q$insert into public.accounts (user_id, name)
     values ('11111111-1111-1111-1111-111111111111', 'spoof')$q$, array['42501']);
select public.__t_expect_error('B non può usare un conto di A',
  $q$insert into public.transactions (account_id, type, amount_cents)
     values ('a0000000-0000-0000-0000-000000000001', 'expense', 100)$q$, array['23503']);
select public.__t_expect_error('B non può fare un giroconto verso un conto di A',
  $q$insert into public.accounts (id, name) values ('b0000000-0000-0000-0000-000000000001', 'Conto B');
     insert into public.transactions (account_id, type, amount_cents, transfer_account_id)
     values ('b0000000-0000-0000-0000-000000000001', 'transfer', 100,
             'a0000000-0000-0000-0000-000000000002')$q$, array['23503', '23514']);
select public.__t_expect_error('B non può usare una categoria di A',
  $q$insert into public.accounts (id, name) values ('b0000000-0000-0000-0000-000000000002', 'Conto B2');
     insert into public.transactions (account_id, type, amount_cents, category_id)
     values ('b0000000-0000-0000-0000-000000000002', 'expense', 100,
             'c0000000-0000-0000-0000-000000000002')$q$, array['23503', '23514']);

-- ---------------------------------------------------------------
-- 8) Eliminare una categoria non elimina i movimenti
-- ---------------------------------------------------------------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select public.__t_expect_rowcount('A elimina una propria categoria',
  $q$delete from public.categories where id = 'c0000000-0000-0000-0000-000000000002'$q$, 1);
select public.__t_expect_count('il movimento resta, senza categoria',
  $q$select 1 from public.transactions
     where id = 'f0000000-0000-0000-0000-000000000002' and category_id is null$q$, 1);
select public.__t_expect_count('il saldo non cambia dopo l''eliminazione della categoria',
  $q$select 1 from public.account_balances
     where account_id = 'a0000000-0000-0000-0000-000000000001' and balance_cents = 117950$q$, 1);

-- Eliminare un movimento aggiorna il saldo
select public.__t_expect_rowcount('A elimina un proprio movimento',
  $q$delete from public.transactions where id = 'f0000000-0000-0000-0000-000000000002'$q$, 1);
select public.__t_expect_count('saldo dopo eliminazione della spesa = 130000',
  $q$select 1 from public.account_balances
     where account_id = 'a0000000-0000-0000-0000-000000000001' and balance_cents = 130000$q$, 1);

reset role;

-- ---------------------------------------------------------------
-- 9) Cancellando un utente spariscono tutti e soli i suoi dati
-- ---------------------------------------------------------------
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select public.__t_expect_count('dati di B eliminati: conti',
  $q$select 1 from public.accounts where user_id = '22222222-2222-2222-2222-222222222222'$q$, 0);
select public.__t_expect_count('dati di B eliminati: categorie',
  $q$select 1 from public.categories where user_id = '22222222-2222-2222-2222-222222222222'$q$, 0);
select public.__t_expect_count('dati di B eliminati: movimenti',
  $q$select 1 from public.transactions where user_id = '22222222-2222-2222-2222-222222222222'$q$, 0);
select public.__t_expect_count('i conti di A sono intatti',
  $q$select 1 from public.accounts where user_id = '11111111-1111-1111-1111-111111111111'$q$, 3);
select public.__t_expect_count('i movimenti di A sono intatti',
  $q$select 1 from public.transactions where user_id = '11111111-1111-1111-1111-111111111111'$q$, 2);

rollback;
select 'OK: tutti i test di sicurezza e integrità sono stati superati' as risultato;
