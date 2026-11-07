import { act, screen, within } from '@testing-library/react'
import { ELIOTT, LEA, renderApp, testClock } from './render'

const room = (name: string) => within(screen.getByRole('region', { name }))
const findRoom = async (name: string) => within(await screen.findByRole('region', { name }))

test('both Rooms are shown free at first', async () => {
  renderApp({ loggedInAs: ELIOTT.id })

  expect((await findRoom('WC')).getByText('Libre')).toBeInTheDocument()
  expect(room('Salle de bain').getByText('Libre')).toBeInTheDocument()
})

const SECOND = 1000
const MINUTE = 60 * SECOND

// Starts at 14:32 in Paris (UTC+1 in November)
let clock: ReturnType<typeof testClock>
beforeEach(() => {
  clock = testClock(new Date('2026-11-05T13:32:00Z'))
})

test('a Flatmate occupies a free Room', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock })

  await user.click((await findRoom('WC')).getByRole('button', { name: "J'occupe" }))

  expect(await room('WC').findByText('Occupe par Eliott depuis 14:32')).toBeInTheDocument()
  expect(room('WC').queryByText('Libre')).not.toBeInTheDocument()
})

test('a Flatmate frees their own Occupancy', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await user.click((await findRoom('WC')).getByRole('button', { name: "J'occupe" }))

  await user.click(await room('WC').findByRole('button', { name: 'Je libere' }))

  expect(await room('WC').findByText('Libre')).toBeInTheDocument()
  expect(room('WC').queryByText(/Occupe par/)).not.toBeInTheDocument()
})

test("a Flatmate frees another Flatmate's Occupancy", async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await backend.occupy('salle-de-bain', LEA.id, clock.now())

  await user.click((await findRoom('Salle de bain')).getByRole('button', { name: 'Je libere' }))

  expect(await room('Salle de bain').findByText('Libre')).toBeInTheDocument()
})

test('an occupied Room cannot be occupied', async () => {
  const { backend } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await backend.occupy('wc', LEA.id, clock.now())

  expect(await (await findRoom('WC')).findByText('Occupe par Lea depuis 14:32')).toBeInTheDocument()
  expect(room('WC').queryByRole('button', { name: "J'occupe" })).not.toBeInTheDocument()
})

test('the two Rooms are independent', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await user.click((await findRoom('WC')).getByRole('button', { name: "J'occupe" }))

  expect(await room('WC').findByText(/Occupe par Eliott/)).toBeInTheDocument()
  expect(room('Salle de bain').getByText('Libre')).toBeInTheDocument()

  await user.click(room('Salle de bain').getByRole('button', { name: "J'occupe" }))

  expect(await room('Salle de bain').findByText(/Occupee par Eliott/)).toBeInTheDocument()
  expect(room('WC').getByText(/Occupe par Eliott/)).toBeInTheDocument()
})

test('an Occupancy made by another Flatmate appears without reload', async () => {
  const { backend } = renderApp({ loggedInAs: ELIOTT.id, clock })
  expect((await findRoom('WC')).getByText('Libre')).toBeInTheDocument()

  await backend.occupy('wc', LEA.id, clock.now())

  expect(await room('WC').findByText('Occupe par Lea depuis 14:32')).toBeInTheDocument()
})

test('occupying a Room taken while the screen was out of date is refused', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  const wc = await findRoom('WC')
  await backend.occupyUnannounced('wc', LEA.id, clock.now())

  await user.click(wc.getByRole('button', { name: "J'occupe" }))

  expect(await wc.findByRole('alert')).toHaveTextContent('WC deja occupe par Lea.')
  expect(wc.queryByText(/Occupe par Eliott/)).not.toBeInTheDocument()
})

test('the WC frees itself 15 minutes after it was occupied', async () => {
  const { backend } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await backend.occupy('wc', LEA.id, clock.now())
  const wc = await findRoom('WC')
  await wc.findByText(/Occupe par Lea/)

  act(() => clock.advance(14 * MINUTE + 59 * SECOND))
  expect(wc.getByText(/Occupe par Lea/)).toBeInTheDocument()

  act(() => clock.advance(SECOND))
  expect(wc.getByText('Libre')).toBeInTheDocument()
})

test('the Salle de bain frees itself 45 minutes after it was occupied', async () => {
  const { backend } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await backend.occupy('salle-de-bain', LEA.id, clock.now())
  const bathroom = await findRoom('Salle de bain')
  await bathroom.findByText(/Occupee par Lea/)

  act(() => clock.advance(44 * MINUTE + 59 * SECOND))
  expect(bathroom.getByText(/Occupee par Lea/)).toBeInTheDocument()

  act(() => clock.advance(SECOND))
  expect(bathroom.getByText('Libre')).toBeInTheDocument()
})

test('a Room that freed itself can be occupied by another Flatmate', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await backend.occupy('wc', LEA.id, clock.now())
  const wc = await findRoom('WC')
  await wc.findByText(/Occupe par Lea/)
  act(() => clock.advance(15 * MINUTE))

  await user.click(wc.getByRole('button', { name: "J'occupe" }))

  expect(await wc.findByText('Occupe par Eliott depuis 14:47')).toBeInTheDocument()
  expect(wc.queryByRole('alert')).not.toBeInTheDocument()
})

test('both Rooms free themselves one after the other', async () => {
  const { backend } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await backend.occupy('wc', LEA.id, clock.now())
  await backend.occupy('salle-de-bain', ELIOTT.id, clock.now())
  const wc = await findRoom('WC')
  const bathroom = room('Salle de bain')
  await bathroom.findByText(/Occupee par Eliott/)

  act(() => clock.advance(15 * MINUTE))
  expect(wc.getByText('Libre')).toBeInTheDocument()
  expect(bathroom.getByText(/Occupee par Eliott/)).toBeInTheDocument()

  act(() => clock.advance(30 * MINUTE))
  expect(bathroom.getByText('Libre')).toBeInTheDocument()
})
