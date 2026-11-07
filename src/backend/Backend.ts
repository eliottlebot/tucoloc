export type Flatmate = { id: string; name: string }

export type Session = { flatmate: Flatmate }

export type RoomId = 'wc' | 'salle-de-bain'

/** A Room that is occupied; a Room without one is free. */
export type Occupancy = { room: RoomId; flatmateId: string; since: Date }

export class InvalidCredentialsError extends Error {}

/** The account exists but has no Flatmate row, so the app can't use it. */
export class MissingFlatmateError extends Error {}

/** A calendar day, 'YYYY-MM-DD'. */
export type Day = string

export type Expense = {
  id: string
  label: string
  amountCents: number
  date: Day
  payerId: string
  participantIds: string[]
  creatorId: string
  createdAt: Date
}

export type NewExpense = Omit<Expense, 'id'>

/** What editing an Expense can change; the creator and creation time stay. */
export type ExpenseChanges = Pick<Expense, 'label' | 'amountCents' | 'date' | 'payerId' | 'participantIds'>

/** One Flatmate paying another back. */
export type Transfer = { fromId: string; toId: string; cents: number }

/** Everyone paid the suggested transfers; every Expense created before createdAt is settled. */
export type Settlement = { id: string; createdAt: Date; creatorId: string; transfers: Transfer[] }

export type NewSettlement = Omit<Settlement, 'id'>

/** What kind of data changed; listeners refetch that data. */
export type Topic = 'flatmates' | 'occupancies' | 'expenses' | 'settlements'

export type Unsubscribe = () => void

/** All server access goes through this interface (see spec #1, "Backend interface"). */
export interface Backend {
  /** Throws MissingFlatmateError, after logging out, when the account has no Flatmate. */
  getSession(): Promise<Session | null>
  /** Throws InvalidCredentialsError when the email or password is wrong, MissingFlatmateError when the account has no Flatmate. */
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  listFlatmates(): Promise<Flatmate[]>
  listOccupancies(): Promise<Occupancy[]>
  occupy(room: RoomId, flatmateId: string, since: Date): Promise<void>
  free(room: RoomId): Promise<void>
  listExpenses(): Promise<Expense[]>
  createExpense(expense: NewExpense): Promise<void>
  updateExpense(id: string, changes: ExpenseChanges): Promise<void>
  deleteExpense(id: string): Promise<void>
  listSettlements(): Promise<Settlement[]>
  createSettlement(settlement: NewSettlement): Promise<void>
  deleteSettlement(id: string): Promise<void>
  /** Calls onChange whenever data changes, on this device or another one. */
  subscribe(onChange: (topic: Topic) => void): Unsubscribe
}
