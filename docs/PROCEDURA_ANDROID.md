# Procedura completa da telefono Android

Serve solo il telefono (Chrome) e questi tre account gratuiti: Supabase (già fatto), GitHub, e nient'altro.
Dove una pagina si vede male, in Chrome apri il menu ⋮ e attiva "Sito desktop".

Tieni a portata di mano, dal tuo progetto Supabase:
- il **Project URL** (`https://<id>.supabase.co`)
- la **Publishable key** (`sb_publishable_...`)

Non servono e non vanno mai usate: Secret key, service_role, password del database.

## 1. GitHub: repository, Pages e variabili

1. Su github.com crea un account (se non l'hai) e poi **New repository**: nome `personal-finance-manager`, **Public**, senza README. (Public è necessario per Pages gratuito; nel repository non c'è nessun segreto.)
2. Nel repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → scheda Variables → New repository variable**. Crea due variabili con questi nomi esatti:
   - `VITE_SUPABASE_URL` = il Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = la Publishable key
   (Sono "Variables", non "Secrets": sono valori pubblici per progetto, la protezione dei dati è nelle regole RLS del database.)

## 2. Caricamento del progetto

1. Nel repository: **Add file → Upload files**, scegli lo ZIP `personal-finance-manager.zip` (resta zippato), poi **Commit changes**.
2. **Add file → Create new file**. Come nome scrivi esattamente `.github/workflows/deploy.yml` (le barre creano le cartelle). Incolla il contenuto del file `deploy.yml` allegato alla chat (è lo stesso che trovi nello ZIP in `docs/deploy.yml`). **Commit changes**.

Il commit parte da solo e il workflow: spacchetta lo ZIP nel repository, installa, controlla i tipi, esegue i test, prova la migrazione SQL e i test di sicurezza su un Postgres vero, costruisce l'app e la pubblica.

## 3. Controlla il risultato

Scheda **Actions** → l'ultimo "Verifica e pubblicazione".
- Tutto verde: l'app è online. L'indirizzo è nella scheda del passaggio `deploy` e in Settings → Pages (forma `https://<utente>.github.io/personal-finance-manager/`).
- Rosso: apri il passaggio con la ✗ e mandami il testo dell'errore. Non proseguire finché non è verde.

Un Actions verde dimostra che codice, test e SQL funzionano su un Postgres di prova che simula Supabase. NON dimostra ancora che il tuo Supabase sia configurato: lo fai al punto 4.

## 4. Database: configura e verifica il tuo Supabase

Nel repository apri `supabase/migrations/20261017000000_init_personal_finance.sql` e tocca l'icona **Copy raw file**.

1. Dashboard Supabase → progetto **Personal Finance Manager** (controlla il nome) → **SQL Editor → New query**.
2. Incolla e premi **Run**. Deve comparire "Success". In caso di errore non rieseguire: copiami il messaggio.
3. Nuova query: incolla `supabase/verify.sql` (stessa procedura) → Run. Tutte e 5 le righe devono avere `ok = true`.
4. Nuova query: incolla `supabase/tests/security_and_integrity.sql` → Run. Deve comparire "OK: tutti i test…". Non lascia dati. Se compare "FAIL […]", esegui da solo `rollback;` e mandami il messaggio.

Solo dopo questi tre passaggi il database è configurato e verificato.

## 5. Supabase Auth

**Authentication → URL Configuration**: come **Site URL** metti l'indirizzo dell'app (punto 3), e aggiungilo anche in **Redirect URLs**.
**Authentication → Sign In / Providers → Email**: per uso personale puoi disattivare "Confirm email"; se resta attivo, dopo la registrazione devi aprire il link nella mail.
Verifica che "Allow anonymous sign-ins" sia disattivato.

## 6. Installa l'app

- **Android**: apri l'indirizzo in Chrome → ⋮ → **Installa app** (o "Aggiungi a schermata Home").
- **PC**: apri lo stesso indirizzo in Chrome o Edge → icona di installazione nella barra degli indirizzi.

Telefono e PC usano lo stesso account, quindi gli stessi dati: l'app si aggiorna da sola quando la riapri o torni sulla finestra.
La PWA ha bisogno di connessione per leggere e salvare i dati (i dati non vengono memorizzati offline di proposito).

## 7. Prova finale (da fare davvero)

1. Registrati dal telefono, crea un conto, aggiungi un'entrata e un'uscita.
2. Apri l'app sul PC, accedi con lo stesso account: devi vedere conto e movimenti.
3. Registra un secondo account con un'altra email: non deve vedere nulla del primo.

## 8. Aggiornamenti futuri

Quando ti do un nuovo ZIP: **Add file → Upload files** nel repository, carica il nuovo `.zip` (può avere qualsiasi nome) → Commit. Il workflow lo importa, rifà tutti i controlli e ripubblica. Se cambia l'SQL ti dirò io quale file eseguire.

## Problemi frequenti

- *Actions rosso su "Controlla le variabili"*: mancano o hanno il nome sbagliato le due Variables (punto 1.3).
- *L'app mostra "Configurazione necessaria"*: la variabile contiene un valore sbagliato o una chiave segreta; correggi la variabile e rilancia il workflow (Actions → Run workflow).
- *Pagina bianca dopo un aggiornamento*: chiudi e riapri l'app una volta (aggiornamento della PWA).
- *Alternativa a GitHub Pages*: Cloudflare Pages o Netlify collegati al repository, comando `npm run build`, cartella `dist`, stesse due variabili.
