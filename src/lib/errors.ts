// Traduce gli errori tecnici di Postgres/PostgREST in messaggi comprensibili.
const RULES: [RegExp, string][] = [
  [/accounts_user_name_key/, 'Esiste già un conto con questo nome.'],
  [/categories_user_kind_name_key/, 'Esiste già una categoria con questo nome.'],
  [/accounts_name_len|categories_name_len/, 'Il nome non può essere vuoto e può avere al massimo 80 caratteri.'],
  [/transactions_amount_range/, "L'importo deve essere maggiore di zero e rientrare nei limiti consentiti."],
  [/transactions_note_len/, 'La nota può avere al massimo 500 caratteri.'],
  [/transactions_date_range/, 'La data deve essere compresa tra il 2000 e il 2100.'],
  [/transactions_transfer_distinct/, 'Un giroconto richiede due conti diversi.'],
  [/transactions_transfer_/, 'Giroconto non valido: controlla i due conti.'],
  [/violates foreign key constraint/, "Operazione non consentita: l'elemento è collegato ad altri dati."],
  [/row-level security|permission denied/, 'Operazione non consentita per il tuo account.'],
  [/JWT expired|invalid JWT/i, "Sessione scaduta: esci e accedi di nuovo."],
  [/Invalid login credentials/i, 'Email o password non corretti.'],
  [/Email not confirmed/i, "Conferma prima l'indirizzo email: ti abbiamo inviato un link."],
  [/User already registered/i, 'Esiste già un account con questa email: prova ad accedere.'],
  [/Password should be at least|weak_password/i, 'Password troppo debole: usa almeno 8 caratteri.'],
  [/rate limit|too many requests/i, 'Troppi tentativi ravvicinati: attendi qualche minuto e riprova.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'Connessione assente o instabile. Riprova tra poco.'],
]

export function friendlyError(message: string): string {
  for (const [pattern, text] of RULES) if (pattern.test(message)) return text
  return message
}
