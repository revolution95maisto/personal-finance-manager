# Personal Finance Manager

App web per tenere sotto controllo conti, entrate, uscite e giroconti. Si usa bene anche da smartphone.
Stack: React, TypeScript, Vite, Supabase (Auth + Postgres con Row Level Security).

## Come è organizzato

- `supabase/migrations/20261017000000_init_personal_finance.sql`: tabelle, vincoli, indici, trigger e policy RLS.
- `supabase/verify.sql`: controlla lo stato del database dopo la migrazione.
- `supabase/tests/security_and_integrity.sql`: test di sicurezza (RLS) e correttezza dei movimenti, eseguibile nel SQL Editor.
- `supabase/ci/00_supabase_stub.sql`: serve solo ai controlli automatici su GitHub, NON va eseguito su Supabase.
- `.github/workflows/deploy.yml`: a ogni push esegue typecheck, test, migrazione + test RLS su Postgres 16, build e pubblicazione su GitHub Pages.
- `public/`: manifest, icone e service worker della PWA.
- `src/`: app React. `src/lib/*.test.ts`: test automatici eseguiti con `npm test`.

Importi sempre in centesimi (interi). Il frontend non invia mai `user_id`: lo imposta il database da `auth.uid()`.

> Da telefono, senza PC: segui `docs/PROCEDURA_ANDROID.md`. I passi qui sotto sono per chi lavora da PC.

## Passi, nell'ordine

### 1. Variabili d'ambiente (`.env.local`)

```bash
cp .env.example .env.local
```

Apri `.env.local` e incolla:

- `VITE_SUPABASE_URL`: il Project URL del progetto NUOVO (formato `https://<id>.supabase.co`);
- `VITE_SUPABASE_PUBLISHABLE_KEY`: la Publishable key (`sb_publishable_...`).

Non usare mai la Secret key (`sb_secret_...`) né la `service_role`: l'app si rifiuta di partire se la riconosce.
`.env.local` è già escluso da git.

### 2. Dipendenze e test locali

```bash
npm install
npm run typecheck
npm test
```

I test locali non hanno bisogno di Supabase.

### 3. Database: esegui la migrazione (una sola volta)

1. Apri la dashboard Supabase e controlla che sia selezionato il progetto dedicato a questa app.
2. Vai su SQL Editor, crea una nuova query.
3. Incolla TUTTO il contenuto di `supabase/migrations/20261017000000_init_personal_finance.sql` ed esegui con Run.
4. Deve comparire "Success". Se compare un errore, non rieseguire: copialo e fammelo vedere.

### 4. Verifica del database

1. Nuova query, incolla `supabase/verify.sql`, Run: tutte le righe devono avere `ok = true`.
2. Nuova query, incolla `supabase/tests/security_and_integrity.sql`, Run: deve comparire "OK: tutti i test ...".
   Il test lavora dentro una transazione annullata alla fine: non lascia dati.
   Se compare "FAIL [...]", esegui da solo `rollback;` e copia il messaggio.

Solo dopo questi due passaggi il database si può considerare configurato e verificato.

### 5. Impostazioni di Auth

In Authentication → Providers verifica che Email sia attivo. Per uso personale puoi disattivare "Confirm email"; se la lasci attiva, dopo la registrazione devi confermare l'indirizzo dalla mail.

### 6. Avvio

```bash
npm run dev
```

Registrati, crea un conto, poi dalla scheda Categorie premi "Aggiungi le categorie di base".

Dopo la prima build l'app è installabile (PWA). Prima di pubblicare l'app: `npm run build && npm run check:secrets`.

## Regole di sicurezza implementate

- RLS attiva su tutte le tabelle; ogni utente vede e modifica solo righe con il proprio `user_id`.
- Il ruolo `anon` non ha alcun permesso sulle tabelle, sulla vista e sulle funzioni.
- Chiavi composite `(id, user_id)`: impossibile collegare un movimento a conti o categorie di un altro utente.
- Importi interi positivi; giroconti solo tra conti diversi, della stessa valuta, senza categoria; la categoria deve coincidere con il tipo di movimento.
- Conti con movimenti non eliminabili (si archiviano) e con valuta non modificabile; conti archiviati non accettano nuovi movimenti.
- Saldi calcolati da una vista `security_invoker`, mai salvati: non possono andare fuori sincrono.
