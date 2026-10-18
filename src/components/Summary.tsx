import { listAccountBalances, listTransactionsBetween } from '../lib/api'
import { monthKey, monthlyTotals, monthRange } from '../lib/balance'
import { formatCents } from '../lib/money'
import { useResource } from '../lib/useResource'

export function Summary() {
  const balances = useResource(listAccountBalances)
  const month = useResource(() => {
    const range = monthRange(new Date())
    return listTransactionsBetween(range.start, range.next)
  })

  const error = balances.error ?? month.error
  if (error) return <p className="error">{error}</p>
  if (!balances.data || !month.data) return <p className="muted">Caricamento…</p>

  const active = balances.data.filter((a) => !a.archived)
  if (active.length === 0) {
    return (
      <section className="stack">
        <h2>Benvenuto</h2>
        <p className="muted">Per iniziare crea il tuo primo conto nella scheda Conti.</p>
      </section>
    )
  }

  const totalByCurrency = new Map<string, number>()
  for (const a of active) totalByCurrency.set(a.currency, (totalByCurrency.get(a.currency) ?? 0) + a.balance_cents)

  const currencyByAccount = new Map(balances.data.map((a) => [a.account_id, a.currency]))
  const totals = monthlyTotals(month.data, currencyByAccount, monthKey(new Date()))
  const monthName = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  return (
    <div className="stack">
      <section className="hero">
        <p className="hero-label">Patrimonio totale</p>
        {[...totalByCurrency].map(([currency, cents]) => (
          <p key={currency} className="hero-amount">
            {formatCents(cents, currency)}
          </p>
        ))}
      </section>

      <section className="card stack">
        <h2>{monthName}</h2>
        {Object.keys(totals).length === 0 && <p className="muted">Nessun movimento questo mese.</p>}
        {Object.entries(totals).map(([currency, t]) => (
          <div key={currency} className="row">
            <span className="in">Entrate {formatCents(t.income, currency)}</span>
            <span className="out">Uscite {formatCents(t.expense, currency)}</span>
            <strong>Differenza {formatCents(t.income - t.expense, currency)}</strong>
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2>Conti</h2>
        {active.map((a) => (
          <div key={a.account_id} className="row between">
            <span>{a.name}</span>
            <strong className="num">{formatCents(a.balance_cents, a.currency)}</strong>
          </div>
        ))}
      </section>
    </div>
  )
}
