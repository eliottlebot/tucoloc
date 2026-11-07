import { ConnectionError, InvalidCredentialsError, MissingFlatmateError, type Backend, type Expense, type ExpenseChanges, type Flatmate, type NewExpense, type NewSettlement, type Occupancy, type RoomId, type Session, type Settlement, type Topic, type Unsubscribe } from './Backend'

/** An account without a name has no Flatmate row. */
type Account = { id: string; name?: string; email: string; password: string }

export class InMemoryBackend implements Backend {
  private accounts: Account[]
  private sessionFlatmateId: string | null
  private occupancies: Occupancy[] = []
  private expenses: Expense[] = []
  private settlements: Settlement[] = []
  private settlementCount = 0
  private listeners = new Set<(topic: Topic) => void>()
  private offline = false

  constructor(options: { accounts: Account[]; loggedInAs?: string }) {
    this.accounts = options.accounts.map((a) => ({ ...a }))
    this.sessionFlatmateId = options.loggedInAs ?? null
  }

  async getSession(): Promise<Session | null> {
    this.failIfOffline()
    const account = this.accounts.find((a) => a.id === this.sessionFlatmateId)
    if (!account) return null
    if (!hasFlatmate(account)) {
      this.sessionFlatmateId = null
      throw new MissingFlatmateError()
    }
    return { flatmate: toFlatmate(account) }
  }

  async login(email: string, password: string): Promise<Session> {
    this.failIfOffline()
    const account = this.accounts.find((a) => a.email === email && a.password === password)
    if (!account) throw new InvalidCredentialsError()
    if (!hasFlatmate(account)) throw new MissingFlatmateError()
    this.sessionFlatmateId = account.id
    return { flatmate: toFlatmate(account) }
  }

  async logout(): Promise<void> {
    this.failIfOffline()
    this.sessionFlatmateId = null
  }

  async listFlatmates(): Promise<Flatmate[]> {
    this.failIfOffline()
    return this.accounts.filter(hasFlatmate).map(toFlatmate)
  }

  async listOccupancies(): Promise<Occupancy[]> {
    this.failIfOffline()
    return [...this.occupancies]
  }

  async occupy(room: RoomId, flatmateId: string, since: Date): Promise<void> {
    this.failIfOffline()
    await this.occupyUnannounced(room, flatmateId, since)
    this.emit('occupancies')
  }

  /** Test helper: an Occupancy from another device whose live update hasn't arrived yet. */
  async occupyUnannounced(room: RoomId, flatmateId: string, since: Date): Promise<void> {
    this.occupancies = [...this.occupancies.filter((o) => o.room !== room), { room, flatmateId, since }]
  }

  async free(room: RoomId): Promise<void> {
    this.failIfOffline()
    this.occupancies = this.occupancies.filter((o) => o.room !== room)
    this.emit('occupancies')
  }

  async listExpenses(): Promise<Expense[]> {
    this.failIfOffline()
    return [...this.expenses]
  }

  async createExpense(expense: NewExpense): Promise<void> {
    this.failIfOffline()
    this.expenses = [...this.expenses, { ...expense, id: `expense-${this.expenses.length + 1}` }]
    this.emit('expenses')
  }

  async updateExpense(id: string, changes: ExpenseChanges): Promise<void> {
    this.failIfOffline()
    this.expenses = this.expenses.map((e) => (e.id === id ? { ...e, ...changes } : e))
    this.emit('expenses')
  }

  async deleteExpense(id: string): Promise<void> {
    this.failIfOffline()
    this.expenses = this.expenses.filter((e) => e.id !== id)
    this.emit('expenses')
  }

  async listSettlements(): Promise<Settlement[]> {
    this.failIfOffline()
    return [...this.settlements]
  }

  async createSettlement(settlement: NewSettlement): Promise<void> {
    this.failIfOffline()
    this.settlements = [...this.settlements, { ...settlement, id: `settlement-${++this.settlementCount}` }]
    this.emit('settlements')
  }

  async deleteSettlement(id: string): Promise<void> {
    this.failIfOffline()
    this.settlements = this.settlements.filter((s) => s.id !== id)
    this.emit('settlements')
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

  /** Test helper: every call fails as if the server can't be reached, until goOnline. */
  goOffline() {
    this.offline = true
  }

  goOnline() {
    this.offline = false
  }

  private failIfOffline() {
    if (this.offline) throw new ConnectionError()
  }

  private emit(topic: Topic) {
    this.listeners.forEach((listener) => listener(topic))
  }
}

function hasFlatmate(account: Account): account is Account & Flatmate {
  return account.name !== undefined
}

function toFlatmate({ id, name }: Account & Flatmate): Flatmate {
  return { id, name }
}
