import { useState, type FormEvent } from 'react'
import { friendlyError } from '../lib/errors'
import { getSupabase } from '../lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const auth = getSupabase().auth
    if (mode === 'in') {
      const { error: authError } = await auth.signInWithPassword({ email, password })
      if (authError) setError(friendlyError(authError.message))
    } else {
      const { data, error: authError } = await auth.signUp({ email, password })
      if (authError) setError(friendlyError(authError.message))
      else if (!data.session) setInfo("Account creato. Apri l'email di conferma, poi accedi.")
    }
    setBusy(false)
  }

  return (
    <main className="login">
      <h1>Personal Finance Manager</h1>
      <p className="muted">Entrate, uscite e saldi dei tuoi conti, sempre con te.</p>
      <form onSubmit={submit} className="stack">
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={mode === 'up' ? 8 : undefined}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}
        <button className="primary" disabled={busy}>
          {mode === 'in' ? 'Accedi' : 'Crea account'}
        </button>
      </form>
      <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
      </button>
    </main>
  )
}
