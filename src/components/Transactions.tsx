import { useState, type FormEvent } from 'react'
import {
  createTransaction,
  deleteTransaction,
  listAccountBalances,
  listCategories,
  listTransactions,
} from '../lib/api'
import { todayIso } from '../lib/balance'
import { formatCents, parseAmountToCents } from '../lib/money'
import { TRANSACTION_TYPE_LABELS, type TransactionType } from '../lib/types'
import { useResource } from '../lib/useResource'

export function Transactions() {
  const [limit, setLimit] = useState(100)
  const accounts = useResource(listAccountBalances)
  const categories = useResource(listCategories)
  const txs = useResource(() => listTransactions(limit), [limit])

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const error = accounts.error ?? categories.error ?? txs.error
  if (error) return <p className="error">{error}</p>
  if (!accounts.data || !categories.data || !txs.data) return <p className="muted">Caricamento…</p>

  const activeAccounts = accounts.data.filter((a) => !a.archived)
  const accountById = new Map(accounts.data.map((a) => [a.account_id, a]))
  const categoryById = new Map(categories.data.map((c) => [c.id, c]))

  const fromId = activeAccounts.some((a) => a.account_id === accountId)
    ? accountId
    : (activeAccounts[0]?.account_id ?? '')
  const fromCurrency = accountById.get(fromId)?.currency
  const toOptions = activeAccounts.filter((a) => a.account_id !== fromId && a.currency === fromCurrency)
  const toId = toOptions.some((a) => a.account_id === toAccountId)
    ? toAccountId
    : (toOptions[0]?.account_id ?? '')
  const categoryOptions = categories.data.filter((c) => c.kind === type)
  const categoryValue = categoryOptions.some((c) => c.id === categoryId) ? categoryId : ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const cents = parseAmountToCents(amount)
    if (cents === null || cents <= 0) {
      setFormError('Importo non valido. Esempi: 12,50 oppure 1.250,00')
      return
    }
    if (!fromId) {
      setFormError('Crea prima un conto nella scheda Conti.')
      return
    }
    if (type === 'transfer' && !toId) {
      setFormError('Per un giroconto serve un secondo conto con la stessa valuta.')
      return
    }
    setSaving(true)
    try {
      await createTransaction({
        account_id: fromId,
        type,
        amount_cents: cents,
        occurred_on: date,
        category_id: type === 'transfer' || !categoryValue ? null : categoryValue,
        transfer_account_id: type === 'transfer' ? toId : null,
        note: note.trim() || null,
      })
      setAmount('')
      setNote('')
      accounts.reload()
      txs.reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Eliminare questo movimento?')) return
    try {
      await deleteTransaction(id)
      accounts.reload()
      txs.reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  return (
    <div className="stack split">
      <form onSubmit={submit} className="card stack">
        <h2>Nuovo movimento</h2>
        <div className="segmented" role="group" aria-label="Tipo di movimento">
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <button type="button" key={t} aria-pressed={type === t} onClick={() => setType(t)}>
              {TRANSACTION_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <label>
          Importo
          <input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label>
          {type === 'transfer' ? 'Da conto' : 'Conto'}
          <select value={fromId} onChange={(e) => setAccountId(e.target.value)}>
            {activeAccounts.length === 0 && <option value="">Nessun conto</option>}
            {activeAccounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </label>
        {type === 'transfer' ? (
          <label>
            A conto
            <select value={toId} onChange={(e) => setToAccountId(e.target.value)}>
              {toOptions.length === 0 && <option value="">Nessun conto compatibile</option>}
              {toOptions.map((a) => (
                <option key={a.account_id} value={a.account_id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Categoria
            <select value={categoryValue} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Senza categoria</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Data
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Nota
          <input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {formError && <p className="error">{formError}</p>}
        <button className="primary" disabled={saving}>
          Salva movimento
        </button>
      </form>

      <section className="card stack">
        <h2>Ultimi movimenti</h2>
        {txs.data.length === 0 && <p className="muted">Ancora nessun movimento.</p>}
        {txs.data.map((t) => {
          const acc = accountById.get(t.account_id)
          const currency = acc?.currency ?? 'EUR'
          const label =
            t.type === 'transfer'
              ? `Giroconto verso ${accountById.get(t.transfer_account_id ?? '')?.name ?? '?'}`
              : (categoryById.get(t.category_id ?? '')?.name ?? 'Senza categoria')
          const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''
          return (
            <div key={t.id} className="tx">
              <div>
                <strong>{label}</strong>
                <span className="muted small">
                  {t.occurred_on} · {acc?.name ?? '?'}
                  {t.note ? ` · ${t.note}` : ''}
                </span>
              </div>
              <div className="tx-right">
                <span className={`num ${t.type}`}>
                  {sign}
                  {formatCents(t.amount_cents, currency)}
                </span>
                <button className="link" onClick={() => void remove(t.id)}>
                  Elimina
                </button>
              </div>
            </div>
          )
        })}
        {txs.data.length >= limit && (
          <button type="button" className="secondary" onClick={() => setLimit(limit + 100)}>
            Mostra altri
          </button>
        )}
      </section>
    </div>
  )
}
