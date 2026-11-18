import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { InvalidCredentialsError, MissingFlatmateError, type Backend, type Session } from './backend/Backend'
import { watchConnection } from './backend/watchConnection'
import { useLive } from './useLive'
import { HomeScreen } from './HomeScreen'
import { Expenses } from './Expenses'
import { Recipes } from './Recipes'
import { HouseIcon, LogOutIcon, SaladIcon, ScaleIcon, ScrollTextIcon } from './icons'
import { ShoppingList } from './ShoppingList'
import type { Clock } from './clock'
import { display } from './ui'
// Inlined in the bundle: without connection, a picture fetched from the server would not load either.
import sadTuco from './assets/sad_tuco.png?inline'
import pissedTuco from './assets/pissed_tuco.png?inline'

const OFFLINE_TUCOS = [
  { src: sadTuco, alt: 'Tuco triste' },
  { src: pissedTuco, alt: 'Tuco enerve' },
]

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
      {!connected && <OfflineBanner />}
      {screen}
    </>
  )
}

/** "Pas de connexion", under a Tuco drawn at random each time the connection is lost. */
function OfflineBanner() {
  const [tuco] = useState(() => OFFLINE_TUCOS[Math.floor(Math.random() * OFFLINE_TUCOS.length)])
  return (
    <div
      role="alert"
      className="pointer-events-none fixed inset-0 z-2 flex flex-col items-center justify-center bg-background/85 p-4 text-center text-22 text-action"
    >
      <img className="mb-3 block" src={tuco.src} alt={tuco.alt} width={120} height={120} />
      <p className="m-0 max-w-80">broke ass don't got no signal</p>
    </div>
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
      <img className="mx-auto mt-12 block" src="/logo.png" alt="" width={100} height={100} />
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

/** The yellow buttons to the other screens, in the bottom bar. */
const navButton = 'grid size-16.5 place-items-center rounded-card bg-highlight p-0 text-card'

/** The home screen (tonight's Meal, Rooms), and the other screens of the bottom bar: Tricount (Expenses), Recettes (Recipes), Courses (Shopping List). */
type Screen = 'home' | 'expenses' | 'recipes' | 'shopping'

function Home({ backend, clock, session, onLogout }: { backend: Backend; clock: Clock; session: Session; onLogout: () => void }) {
  const [screen, setScreen] = useState<Screen>('home')
  const flatmates = useLive(backend, 'flatmates', () => backend.listFlatmates())
  const me = flatmates?.find((f) => f.id === session.flatmate.id) ?? session.flatmate
  return (
    <>
      <header className="relative flex justify-center">
        <button
          className={`${display} flex flex-col items-center bg-transparent p-0 text-38 leading-none text-action`}
          aria-label={`${me.name.toUpperCase()}, accueil`}
          onClick={() => setScreen('home')}
        >
          <img src="/logo.png" alt="" width={50} height={50} />
          <span>{me.name.toUpperCase()}</span>
        </button>
        <button className="absolute top-6 right-0 bg-transparent p-0 text-action" aria-label="Se deconnecter" onClick={onLogout}>
          <LogOutIcon />
        </button>
      </header>
      <main>
        {screen === 'home' && <HomeScreen backend={backend} clock={clock} me={me} flatmates={flatmates} />}
        {screen === 'expenses' && <Expenses backend={backend} clock={clock} me={me} flatmates={flatmates} />}
        {screen === 'recipes' && <Recipes backend={backend} clock={clock} me={me} flatmates={flatmates} />}
        {screen === 'shopping' && <ShoppingList backend={backend} clock={clock} />}
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 flex justify-center gap-5.5 bg-[linear-gradient(transparent,var(--color-background)_30%)] pt-4 pb-[calc(16px_+_env(safe-area-inset-bottom))]"
        aria-label="Navigation"
      >
        <button className={navButton} aria-label="Accueil" aria-current={screen === 'home'} onClick={() => setScreen('home')}>
          <HouseIcon />
        </button>
        <button className={navButton} aria-label="Tricount" aria-current={screen === 'expenses'} onClick={() => setScreen('expenses')}>
          <ScaleIcon />
        </button>
        <button className={navButton} aria-label="Recettes" aria-current={screen === 'recipes'} onClick={() => setScreen('recipes')}>
          <SaladIcon />
        </button>
        <button className={navButton} aria-label="Courses" aria-current={screen === 'shopping'} onClick={() => setScreen('shopping')}>
          <ScrollTextIcon />
        </button>
      </nav>
    </>
  )
}
