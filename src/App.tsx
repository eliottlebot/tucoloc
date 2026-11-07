import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { InvalidCredentialsError, MissingFlatmateError, type Backend, type Session } from './backend/Backend'
import { watchConnection } from './backend/watchConnection'
import { useLive } from './useLive'
import { HomeScreen } from './HomeScreen'
import { Expenses } from './Expenses'
import { Recipes } from './Recipes'
import { LogOutIcon, SaladIcon, ScaleIcon, ScrollTextIcon } from './icons'
import { ShoppingList } from './ShoppingList'
import type { Clock } from './clock'

type Props = { backend: Backend; clock: Clock }

const MISSING_FLATMATE_MESSAGE = "Ce compte n'est pas encore configure dans Tucoloc."

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
      {!connected && <p role="alert" className="offline-banner">Pas de connexion. Reessaie quand le reseau revient.</p>}
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
      <img className="login-logo" src="/logo.png" alt="" width={100} height={100} />
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

/** The home screen (tonight's Meal, Rooms), and the screens of the bottom bar: Tricount (Expenses), Recettes (Recipes), Courses (Shopping List). */
type Screen = 'home' | 'expenses' | 'recipes' | 'shopping'

function Home({ backend, clock, session, onLogout }: { backend: Backend; clock: Clock; session: Session; onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>('home')
  const flatmates = useLive(backend, 'flatmates', () => backend.listFlatmates())
  const me = flatmates?.find((f) => f.id === session.flatmate.id) ?? session.flatmate
  return (
    <>
      <header className="header">
        <button className="header-home" aria-label={`${me.name.toUpperCase()}, accueil`} onClick={() => setScreen('home')}>
          <img src="/logo.png" alt="" width={50} height={50} />
          <span>{me.name.toUpperCase()}</span>
        </button>
        <button className="header-logout" aria-label="Se deconnecter" onClick={onLogout}>
          <LogOutIcon />
        </button>
      </header>
      <main>
        {screen === 'home' && <HomeScreen backend={backend} clock={clock} me={me} flatmates={flatmates} />}
        {screen === 'expenses' && <Expenses backend={backend} clock={clock} me={me} flatmates={flatmates} />}
        {screen === 'recipes' && <Recipes backend={backend} clock={clock} me={me} flatmates={flatmates} />}
        {screen === 'shopping' && <ShoppingList backend={backend} clock={clock} />}
      </main>
      <nav className="bottom-bar" aria-label="Navigation">
        <button aria-label="Tricount" aria-current={screen === 'expenses'} onClick={() => setScreen('expenses')}>
          <ScaleIcon />
        </button>
        <button aria-label="Recettes" aria-current={screen === 'recipes'} onClick={() => setScreen('recipes')}>
          <SaladIcon />
        </button>
        <button aria-label="Courses" aria-current={screen === 'shopping'} onClick={() => setScreen('shopping')}>
          <ScrollTextIcon />
        </button>
      </nav>
    </>
  )
}
