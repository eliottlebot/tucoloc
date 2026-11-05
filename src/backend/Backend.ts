export type Flatmate = { id: string; name: string }

export type Session = { flatmate: Flatmate }

export class InvalidCredentialsError extends Error {}

/** What kind of data changed; listeners refetch that data. */
export type Topic = 'flatmates'

export type Unsubscribe = () => void

/** All server access goes through this interface (see spec #1, "Backend interface"). */
export interface Backend {
  getSession(): Promise<Session | null>
  /** Throws InvalidCredentialsError when the email or password is wrong. */
  login(email: string, password: string): Promise<Session>
  logout(): Promise<void>
  listFlatmates(): Promise<Flatmate[]>
  /** Calls onChange whenever data changes, on this device or another one. */
  subscribe(onChange: (topic: Topic) => void): Unsubscribe
}
