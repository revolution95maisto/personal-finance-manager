import { useState, type FormEvent } from 'react'
import { createAccount, listAccountBalances, setAccountArchived } from '../lib/api'
import { formatCents, parseAmountToCents } from '../lib/money'
import { ACCOUNT_TYPE_LABELS, type AccountType } from '../lib/types'
import { useResource } from '../lib/useResource'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

export function Accounts() {
  const balances = useResource(listAccountBalances)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [currency, setCurrency] = useState('EUR')
  const [initial, setInitial] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (balances.error) return <p className="error">{balances.error}</p>
  if (!balances.data) return <p className="muted">Caricamento…</p>

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const raw = initial.trim()
    const negative = raw.startsWith('-')
    const cents = raw === '' ? 0 : parseAmountToCents(negative ? raw.slice(1) : raw)
    if (cents === null) {
      setFormError('Saldo iniziale non valido. Esempi: 1.250,00 oppure -300')
      return
    }
    setSaving(true)
    try {
      await createAccount({
        name: name.trim(),
        type,
        currency,
        initial_balance_cents: negative ? -cents : cents,
      })
      setName('')
      setInitial('')
      balances.reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setSaving(false)
    }
  }

  async function toggleArchived(id: string, archived: boolean) {
    try {
      await setAccountArchived(id, archived)
      balances.reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  return (
    <div className="stack split">
      <form onSubmit={submit} className="card stack">
        <h2>Nuovo conto</h2>
        <label>
          Nome
          <input value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valuta
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Saldo iniziale
          <input inputMode="decimal" placeholder="0,00" value={initial} onChange={(e) => setInitial(e.target.value)} />
        </label>
        {formError && <p className="error">{formError}</p>}
        <button className="primary" disabled={saving}>
          Crea conto
        </button>
      </form>

      <section className="card stack">
        <h2>I tuoi conti</h2>
        {balances.data.length === 0 && <p className="muted">Nessun conto: creane uno qui sopra.</p>}
        {balances.data.map((a) => (
          <div key={a.account_id} className={`row between${a.archived ? ' archived' : ''}`}>
            <div>
              <strong>{a.name}</strong>
              <span className="muted small">
                {ACCOUNT_TYPE_LABELS[a.type]} · {a.currency}
                {a.archived ? ' · archiviato' : ''}
              </span>
            </div>
            <div className="tx-right">
              <span className="num">{formatCents(a.balance_cents, a.currency)}</span>
              <button className="link" onClick={() => void toggleArchived(a.account_id, !a.archived)}>
                {a.archived ? 'Riattiva' : 'Archivia'}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
