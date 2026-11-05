import { useEffect, useState, type FormEvent } from 'react'
import { InvalidCredentialsError, type Backend, type Session } from './backend/Backend'
import { useLive } from './useLive'
import { Rooms } from './Rooms'
import type { Clock } from './clock'

type Props = { backend: Backend; clock: Clock }

export function App({ backend, clock }: Props) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    backend.getSession().then(setSession)
  }, [backend])

  if (session === undefined) return null
  if (session === null) return <LoginScreen backend={backend} onLogin={setSession} />
  return (
    <Home
      backend={backend}
      clock={clock}
      session={session}
      onLogout={async () => {
        await backend.logout()
        setSession(null)
      }}
    />
  )
}

function LoginScreen({ backend, onLogin }: { backend: Backend; onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      onLogin(await backend.login(email, password))
    } catch (err) {
      if (!(err instanceof InvalidCredentialsError)) throw err
      setError('Email ou mot de passe incorrect.')
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>Tucoloc</h1>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Mot de passe
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">Se connecter</button>
    </form>
  )
}

const TABS = ['Pièces', 'Dépenses', 'Repas'] as const

function Home({ backend, clock, session, onLogout }: { backend: Backend; clock: Clock; session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Pièces')
  const flatmates = useLive(backend, 'flatmates', () => backend.listFlatmates())
  const me = flatmates?.find((f) => f.id === session.flatmate.id) ?? session.flatmate
  return (
    <div>
      <header>
        <span>{me.name}</span>
        <button onClick={onLogout}>Se déconnecter</button>
      </header>
      <div role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tab}>
        {tab === 'Pièces' && <Rooms backend={backend} clock={clock} me={me} flatmates={flatmates} />}
      </div>
    </div>
  )
}
