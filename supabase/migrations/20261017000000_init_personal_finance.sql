-- =====================================================================
-- Personal Finance Manager - migrazione iniziale
-- Da eseguire UNA SOLA VOLTA nel SQL Editor del progetto Supabase
-- dedicato a questa app (controlla il nome del progetto in alto a sinistra).
-- Importi sempre in centesimi (bigint): nessun numero decimale.
-- =====================================================================

-- ---------- Tipi ----------
create type public.account_type as enum
  ('cash', 'checking', 'savings', 'credit_card', 'investment', 'other');
create type public.category_kind as enum ('income', 'expense');
create type public.transaction_type as enum ('income', 'expense', 'transfer');

-- ---------- Funzioni generiche per i trigger ----------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create function public.prevent_user_id_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id non modificabile' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------- Conti ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  type public.account_type not null default 'checking',
  currency char(3) not null default 'EUR',
  initial_balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_name_len check (char_length(btrim(name)) between 1 and 80),
  constraint accounts_currency_fmt check (currency ~ '^[A-Z]{3}$'),
  constraint accounts_initial_range
    check (initial_balance_cents between -100000000000000 and 100000000000000),
  constraint accounts_user_name_key unique (user_id, name),
  constraint accounts_id_user_key unique (id, user_id)
);

-- ---------- Categorie ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind public.category_kind not null,
  color text,
  created_at timestamptz not null default now(),
  constraint categories_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint categories_color_fmt check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  constraint categories_user_kind_name_key unique (user_id, kind, name),
  constraint categories_id_user_key unique (id, user_id)
);

-- ---------- Movimenti ----------
-- income/expense: muovono il saldo di account_id.
-- transfer: sposta amount_cents da account_id a transfer_account_id.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  type public.transaction_type not null,
  amount_cents bigint not null,
  occurred_on date not null default current_date,
  category_id uuid,
  transfer_account_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_amount_range check (amount_cents between 1 and 100000000000000),
  constraint transactions_date_range
    check (occurred_on between date '2000-01-01' and date '2100-12-31'),
  constraint transactions_note_len check (note is null or char_length(note) <= 500),
  constraint transactions_transfer_shape
    check ((type = 'transfer') = (transfer_account_id is not null)),
  constraint transactions_transfer_distinct
    check (transfer_account_id is null or transfer_account_id <> account_id),
  constraint transactions_transfer_no_category
    check (type <> 'transfer' or category_id is null),
  -- Le chiavi composite impediscono di collegare dati di utenti diversi.
  -- ON DELETE CASCADE serve solo alla cancellazione di un utente (tutti i suoi dati insieme).
  -- L'eliminazione diretta di un conto che ha movimenti è bloccata dal trigger guard_account_delete.
  constraint transactions_account_fk
    foreign key (account_id, user_id) references public.accounts (id, user_id)
    on delete cascade,
  constraint transactions_transfer_account_fk
    foreign key (transfer_account_id, user_id) references public.accounts (id, user_id)
    on delete cascade,
  constraint transactions_category_fk
    foreign key (category_id, user_id) references public.categories (id, user_id)
    on delete set null (category_id)
);

-- ---------- Indici ----------
create index transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc, created_at desc);
create index transactions_account_idx
  on public.transactions (user_id, account_id, occurred_on desc);
create index transactions_transfer_account_idx
  on public.transactions (user_id, transfer_account_id) where transfer_account_id is not null;
create index transactions_category_idx
  on public.transactions (user_id, category_id) where category_id is not null;

-- ---------- Trigger di coerenza ----------
create function public.validate_transaction() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_cat_kind public.category_kind;
  v_cur_from char(3);
  v_cur_to char(3);
  v_archived boolean;
begin
  if new.category_id is not null then
    select kind into v_cat_kind from public.categories where id = new.category_id;
    if v_cat_kind is null or v_cat_kind::text <> new.type::text then
      raise exception 'La categoria non corrisponde al tipo di movimento'
        using errcode = '23514';
    end if;
  end if;

  select currency, archived into v_cur_from, v_archived
    from public.accounts where id = new.account_id;

  if tg_op = 'INSERT' and coalesce(v_archived, false) then
    raise exception 'Il conto è archiviato: riattivalo prima di aggiungere movimenti'
      using errcode = '23514';
  end if;

  if new.type = 'transfer' then
    select currency into v_cur_to from public.accounts where id = new.transfer_account_id;
    if v_cur_from is distinct from v_cur_to then
      raise exception 'I giroconti richiedono due conti con la stessa valuta'
        using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

create function public.guard_account_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.currency is distinct from old.currency and exists (
    select 1 from public.transactions
    where account_id = old.id or transfer_account_id = old.id
  ) then
    raise exception 'Non puoi cambiare la valuta di un conto che ha già movimenti'
      using errcode = '23514';
  end if;
  return new;
end $$;

-- Un conto con movimenti non si elimina (si archivia). Il controllo vale solo per le
-- eliminazioni dirette: dentro una cascata (cancellazione dell'utente) la profondità dei
-- trigger è maggiore di 1 e l'eliminazione è consentita.
create function public.guard_account_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 and exists (
    select 1 from public.transactions
    where account_id = old.id or transfer_account_id = old.id
  ) then
    raise exception 'Il conto ha dei movimenti: archivialo invece di eliminarlo'
      using errcode = '23503';
  end if;
  return old;
end $$;

create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger accounts_user_id_immutable before update on public.accounts
  for each row execute function public.prevent_user_id_change();
create trigger accounts_guard_update before update on public.accounts
  for each row execute function public.guard_account_update();
create trigger accounts_guard_delete before delete on public.accounts
  for each row execute function public.guard_account_delete();

create trigger categories_user_id_immutable before update on public.categories
  for each row execute function public.prevent_user_id_change();

create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger transactions_user_id_immutable before update on public.transactions
  for each row execute function public.prevent_user_id_change();
create trigger transactions_validate before insert or update on public.transactions
  for each row execute function public.validate_transaction();

-- ---------- Saldi calcolati (la vista rispetta l'RLS di chi la interroga) ----------
create view public.account_balances with (security_invoker = true) as
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

-- ---------- Categorie di base (idempotente, solo per l'utente autenticato) ----------
create function public.create_default_categories() returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'Utente non autenticato' using errcode = '42501';
  end if;
  insert into public.categories (name, kind, color) values
    ('Alimentari',    'expense', '#2f7d5b'),
    ('Casa',          'expense', '#6b5b95'),
    ('Bollette',      'expense', '#c28a1a'),
    ('Trasporti',     'expense', '#2d6a9f'),
    ('Salute',        'expense', '#b4372f'),
    ('Ristoranti',    'expense', '#d1662f'),
    ('Svago',         'expense', '#8a4f9e'),
    ('Abbigliamento', 'expense', '#3b8a8a'),
    ('Abbonamenti',   'expense', '#5d6b7a'),
    ('Altro',         'expense', '#7a7a7a'),
    ('Stipendio',     'income',  '#1b7f4b'),
    ('Rimborsi',      'income',  '#3b8a8a'),
    ('Regali',        'income',  '#c28a1a'),
    ('Altro',         'income',  '#7a7a7a')
  on conflict (user_id, kind, name) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- Permessi ----------
revoke all on public.accounts, public.categories, public.transactions,
  public.account_balances from anon, authenticated, public;
grant select, insert, update, delete on public.accounts, public.categories,
  public.transactions to authenticated;
grant select on public.account_balances to authenticated;

revoke all on function public.set_updated_at(), public.prevent_user_id_change(),
  public.validate_transaction(), public.guard_account_update(), public.guard_account_delete(),
  public.create_default_categories() from public, anon, authenticated;
grant execute on function public.create_default_categories() to authenticated;

-- ---------- Row Level Security ----------
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy accounts_select on public.accounts for select to authenticated
  using (user_id = (select auth.uid()));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy accounts_update on public.accounts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy accounts_delete on public.accounts for delete to authenticated
  using (user_id = (select auth.uid()));

create policy categories_select on public.categories for select to authenticated
  using (user_id = (select auth.uid()));
create policy categories_insert on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy categories_update on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy categories_delete on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));

create policy transactions_select on public.transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy transactions_insert on public.transactions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy transactions_update on public.transactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy transactions_delete on public.transactions for delete to authenticated
  using (user_id = (select auth.uid()));
