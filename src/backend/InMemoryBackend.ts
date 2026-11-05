import { InvalidCredentialsError, type Backend, type Flatmate, type Session, type Topic, type Unsubscribe } from './Backend'

type Account = Flatmate & { email: string; password: string }

export class InMemoryBackend implements Backend {
  private accounts: Account[]
  private sessionFlatmateId: string | null
  private listeners = new Set<(topic: Topic) => void>()

  constructor(options: { accounts: Account[]; loggedInAs?: string }) {
    this.accounts = options.accounts.map((a) => ({ ...a }))
    this.sessionFlatmateId = options.loggedInAs ?? null
  }

  async getSession(): Promise<Session | null> {
    const account = this.accounts.find((a) => a.id === this.sessionFlatmateId)
    return account ? { flatmate: toFlatmate(account) } : null
  }

  async login(email: string, password: string): Promise<Session> {
    const account = this.accounts.find((a) => a.email === email && a.password === password)
    if (!account) throw new InvalidCredentialsError()
    this.sessionFlatmateId = account.id
    return { flatmate: toFlatmate(account) }
  }

  async logout(): Promise<void> {
    this.sessionFlatmateId = null
  }

  async listFlatmates(): Promise<Flatmate[]> {
    return this.accounts.map(toFlatmate)
  }

  subscribe(onChange: (topic: Topic) => void): Unsubscribe {
    this.listeners.add(onChange)
    return () => this.listeners.delete(onChange)
  }

  /** Test helper: simulates a Flatmate renamed from another device. */
  async renameFlatmate(id: string, name: string): Promise<void> {
    this.accounts = this.accounts.map((a) => (a.id === id ? { ...a, name } : a))
    this.emit('flatmates')
  }

  private emit(topic: Topic) {
    this.listeners.forEach((listener) => listener(topic))
  }
}

function toFlatmate({ id, name }: Account): Flatmate {
  return { id, name }
}
