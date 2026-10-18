import { describe, expect, it } from 'vitest'
import { validateSupabaseEnv } from './env'

const URL = 'https://abcdefghij.supabase.co'

// Le chiavi finte vengono costruite a runtime, così lo scanner dei segreti non le segnala.
const fakeJwt = (role: string) =>
  ['eyJhbGciOiJIUzI1NiJ9', btoa(JSON.stringify({ role })).replace(/=+$/, ''), 'firmafinta1234567890'].join('.')
const secretKey = 'sb_secret_' + 'x'.repeat(24)
const publishableKey = 'sb_publishable_' + 'y'.repeat(24)

describe('validateSupabaseEnv', () => {
  it('accetta URL e Publishable key', () => {
    expect(validateSupabaseEnv(URL, publishableKey)).toBeNull()
  })

  it('accetta la vecchia chiave anon (JWT con ruolo anon)', () => {
    expect(validateSupabaseEnv(URL, fakeJwt('anon'))).toBeNull()
  })

  it('segnala variabili mancanti', () => {
    expect(validateSupabaseEnv(undefined, publishableKey)).toMatch(/mancante/)
    expect(validateSupabaseEnv(URL, undefined)).toMatch(/mancante/)
    expect(validateSupabaseEnv('', '')).toMatch(/mancante/)
  })

  it('rifiuta la Secret key', () => {
    expect(validateSupabaseEnv(URL, secretKey)).toMatch(/SEGRETA/)
  })

  it('rifiuta una chiave service_role', () => {
    expect(validateSupabaseEnv(URL, fakeJwt('service_role'))).toMatch(/SEGRETA/)
  })

  it('rifiuta il segnaposto di .env.example e URL non Supabase', () => {
    expect(validateSupabaseEnv('https://INSERISCI-IL-TUO-PROJECT-ID.supabase.co', publishableKey)).toMatch(/Project URL/)
    expect(validateSupabaseEnv('https://example.com', publishableKey)).toMatch(/Project URL/)
    expect(validateSupabaseEnv(URL, 'INSERISCI-LA-TUA-PUBLISHABLE-KEY')).toMatch(/Publishable/)
  })
})
