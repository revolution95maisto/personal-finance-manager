// Controlla che le variabili d'ambiente siano quelle di un client pubblico.
// Restituisce un messaggio di errore in italiano, oppure null se è tutto a posto.
const URL_PATTERN = /^(https:\/\/[a-z0-9-]+\.supabase\.co|http:\/\/(127\.0\.0\.1|localhost):\d+)\/?$/

function jwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const role = (JSON.parse(json) as { role?: unknown }).role
    return typeof role === 'string' ? role : null
  } catch {
    return null
  }
}

export function validateSupabaseEnv(url: string | undefined, key: string | undefined): string | null {
  if (!url || !key) {
    return 'Configurazione mancante: copia .env.example in .env.local e compila VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.'
  }
  if (!URL_PATTERN.test(url.trim())) {
    return 'VITE_SUPABASE_URL non sembra un Project URL Supabase (formato https://<id-progetto>.supabase.co).'
  }
  const k = key.trim()
  if (k.startsWith('sb_secret_') || jwtRole(k) === 'service_role') {
    return 'Hai inserito una chiave SEGRETA. Nel frontend va usata solo la Publishable key (sb_publishable_...). Sostituiscila e ruota la chiave segreta dalla dashboard Supabase.'
  }
  if (!k.startsWith('sb_publishable_') && jwtRole(k) !== 'anon') {
    return 'VITE_SUPABASE_PUBLISHABLE_KEY non sembra una Publishable key (sb_publishable_...).'
  }
  return null
}
