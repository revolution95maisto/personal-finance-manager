import { useState } from 'react'
import { AuthProvider, useAuth } from './components/AuthProvider'
import { Login } from './components/Login'
import { Summary } from './components/Summary'
import { Transactions } from './components/Transactions'
import { Accounts } from './components/Accounts'
import { Categories } from './components/Categories'
import { envError } from './lib/supabase'

type Tab = 'summary' | 'transactions' | 'accounts' | 'categories'

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'Riepilogo' },
  { id: 'transactions', label: 'Movimenti' },
  { id: 'accounts', label: 'Conti' },
  { id: 'categories', label: 'Categorie' },
]

function Shell() {
  const { session, ready, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('summary')

  if (!ready) return <p className="center-note">Caricamento…</p>
  if (!session) return <Login />

  return (
    <div className="shell">
      <header className="topbar">
        <strong>Personal Finance Manager</strong>
        <button className="link light" onClick={() => void signOut()}>
          Esci
        </button>
      </header>
      <main className="content">
        {tab === 'summary' && <Summary />}
        {tab === 'transactions' && <Transactions />}
        {tab === 'accounts' && <Accounts />}
        {tab === 'categories' && <Categories />}
      </main>
      <nav className="tabbar" aria-label="Sezioni">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  if (envError) {
    return (
      <main className="login">
        <h1>Configurazione necessaria</h1>
        <p className="error">{envError}</p>
        <p className="muted">Dopo aver modificato .env.local riavvia il server con npm run dev.</p>
      </main>
    )
  }
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
