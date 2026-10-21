-- SOLA LETTURA: non modifica nulla. Esegui nel SQL Editor del progetto collegato all'app.
-- Mostra quali oggetti esistono davvero nel database.
select o.nome,
       coalesce(case c.relkind when 'r' then 'tabella' when 'v' then 'vista' else c.relkind::text end,
                'MANCANTE') as stato,
       c.relrowsecurity as rls_attiva
from (values ('accounts'), ('categories'), ('transactions'), ('account_balances')) o (nome)
left join pg_class c on c.relname = o.nome and c.relnamespace = 'public'::regnamespace
order by o.nome;
