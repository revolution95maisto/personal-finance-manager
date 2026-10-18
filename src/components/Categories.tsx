import { useState, type FormEvent } from 'react'
import { createCategory, createDefaultCategories, deleteCategory, listCategories } from '../lib/api'
import type { CategoryKind } from '../lib/types'
import { useResource } from '../lib/useResource'

export function Categories() {
  const categories = useResource(listCategories)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [formError, setFormError] = useState<string | null>(null)

  if (categories.error) return <p className="error">{categories.error}</p>
  if (!categories.data) return <p className="muted">Caricamento…</p>
  const list = categories.data // copia locale: dentro le funzioni il controllo su .data andrebbe perso

  async function run(action: () => Promise<void>) {
    setFormError(null)
    try {
      await action()
      categories.reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      await createCategory({ name: name.trim(), kind })
      setName('')
    })
  }

  const groups: { kind: CategoryKind; title: string }[] = [
    { kind: 'expense', title: 'Uscite' },
    { kind: 'income', title: 'Entrate' },
  ]

  return (
    <div className="stack">
      <form onSubmit={submit} className="card stack">
        <h2>Nuova categoria</h2>
        <label>
          Nome
          <input value={name} maxLength={60} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)}>
            <option value="expense">Uscita</option>
            <option value="income">Entrata</option>
          </select>
        </label>
        {formError && <p className="error">{formError}</p>}
        <button className="primary">Aggiungi categoria</button>
        {list.length === 0 && (
          <button type="button" className="secondary" onClick={() => void run(createDefaultCategories)}>
            Aggiungi le categorie di base
          </button>
        )}
      </form>

      {groups.map((g) => (
        <section key={g.kind} className="card stack">
          <h2>{g.title}</h2>
          {list.filter((c) => c.kind === g.kind).length === 0 && <p className="muted">Nessuna categoria.</p>}
          {list
            .filter((c) => c.kind === g.kind)
            .map((c) => (
              <div key={c.id} className="row between">
                <span>{c.name}</span>
                <button
                  className="link"
                  onClick={() => {
                    if (window.confirm(`Eliminare "${c.name}"? I movimenti restano, senza categoria.`)) {
                      void run(() => deleteCategory(c.id))
                    }
                  }}
                >
                  Elimina
                </button>
              </div>
            ))}
        </section>
      ))}
    </div>
  )
}
