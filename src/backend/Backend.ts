export type Flatmate = { id: string; name: string }

export type Session = { flatmate: Flatmate }

export type RoomId = 'wc' | 'salle-de-bain'

/** A Room that is occupied; a Room without one is free. */
export type Occupancy = { room: RoomId; flatmateId: string; since: Date }

export class InvalidCredentialsError extends Error {}

/** What kind of data changed; listeners refetch that data. */
export type Topic = 'flatmates' | 'occupancies'

export type Unsubscribe = () => void

/** All server access goes through this interface (see spec #1, "Backend interface"). */
export interface Backend {
  getSession(): Promise<Session | null>
  /** Throws InvalidCredentialsError when the email or password is wrong. */
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  listFlatmates(): Promise<Flatmate[]>
  listOccupancies(): Promise<Occupancy[]>
  occupy(room: RoomId, flatmateId: string, since: Date): Promise<void>
  free(room: RoomId): Promise<void>
  /** Calls onChange whenever data changes, on this device or another one. */
  subscribe(onChange: (topic: Topic) => void): Unsubscribe
}
