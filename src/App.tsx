import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { InvalidCredentialsError, MissingFlatmateError, type Backend, type Session } from './backend/Backend'
import { watchConnection } from './backend/watchConnection'
import { useLive } from './useLive'
import { Rooms } from './Rooms'
import { Expenses } from './Expenses'
import { Recipes } from './Recipes'
import type { Clock } from './clock'

type Props = { backend: Backend; clock: Clock }

const MISSING_FLATMATE_MESSAGE = "Ce compte n'est pas encore configuré dans Tucoloc."

export function App({ backend: server, clock }: Props) {
  const [connected, setConnected] = useState(true)
  const backend = useMemo(() => watchConnection(server, setConnected), [server])
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [startupError, setStartupError] = useState<string | null>(null)

  useEffect(() => {
    backend.getSession().then(setSession, (err) => {
      if (!(err instanceof MissingFlatmateError)) throw err
      setStartupError(MISSING_FLATMATE_MESSAGE)
      setSession(null)
    })
  }, [backend])

  let screen: ReactNode = null
  if (session === null) {
    const onLogin = (s: Session) => {
      setStartupError(null)
      setSession(s)
    }
    screen = <LoginScreen backend={backend} initialError={startupError} onLogin={onLogin} />
  } else if (session) {
    screen = (
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
  return (
    <>
      {!connected && <p role="alert">Pas de connexion. Réessaie quand le réseau revient.</p>}
      {screen}
    </>
  )
}

type LoginProps = { backend: Backend; initialError: string | null; onLogin: (s: Session) => void }

function LoginScreen({ backend, initialError, onLogin }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      onLogin(await backend.login(email, password))
    } catch (err) {
      if (err instanceof InvalidCredentialsError) setError('Email ou mot de passe incorrect.')
      else if (err instanceof MissingFlatmateError) setError(MISSING_FLATMATE_MESSAGE)
      else throw err
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
        {tab === 'Dépenses' && <Expenses backend={backend} clock={clock} me={me} flatmates={flatmates} />}
        {tab === 'Repas' && <Recipes backend={backend} me={me} flatmates={flatmates} />}
      </div>
    </div>
  )
}
