import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { validateSupabaseEnv } from './env'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Se non è null l'app mostra il messaggio e non crea nessun client.
export const envError = validateSupabaseEnv(url, key)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (envError || !url || !key) throw new Error(envError ?? 'Configurazione Supabase mancante')
  if (!client) {
    client = createClient(url.trim(), key.trim(), {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  }
  return client
}
