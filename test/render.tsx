import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'
import { InMemoryBackend } from '../src/backend/InMemoryBackend'
import type { Clock } from '../src/clock'

export const ELIOTT = { id: 'eliott', name: 'Eliott', email: 'eliott@coloc.fr', password: 'secret-e' }
export const LEA = { id: 'lea', name: 'Léa', email: 'lea@coloc.fr', password: 'secret-l' }
export const TOM = { id: 'tom', name: 'Tom', email: 'tom@coloc.fr', password: 'secret-t' }
/** An account with no Flatmate row, as when a Supabase user is created but never named. */
export const NO_FLATMATE = { id: 'ghost', email: 'ghost@coloc.fr', password: 'secret-g' }

export function renderApp(options: { loggedInAs?: string; clock?: Clock } = {}) {
  const backend = new InMemoryBackend({ accounts: [ELIOTT, LEA, TOM, NO_FLATMATE], loggedInAs: options.loggedInAs })
  const clock = options.clock ?? { now: () => new Date() }
  const user = userEvent.setup()
  render(<App backend={backend} clock={clock} />)
  return { backend, user }
}
