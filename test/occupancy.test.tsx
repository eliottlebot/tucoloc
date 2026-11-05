import { screen, within } from '@testing-library/react'
import { ELIOTT, LEA, renderApp } from './render'

const room = (name: string) => within(screen.getByRole('region', { name }))
const findRoom = async (name: string) => within(await screen.findByRole('region', { name }))

test('both Rooms are shown free at first', async () => {
  renderApp({ loggedInAs: ELIOTT.id })

  expect((await findRoom('WC')).getByText('Libre')).toBeInTheDocument()
  expect(room('Salle de bain').getByText('Libre')).toBeInTheDocument()
})

// 14:32 in Paris (UTC+1 in November)
const clock = { now: () => new Date('2026-11-05T13:32:00Z') }

test('a Flatmate occupies a free Room', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock })

  await user.click((await findRoom('WC')).getByRole('button', { name: "J'occupe" }))

  expect(await room('WC').findByText('Occupé par Eliott depuis 14:32')).toBeInTheDocument()
  expect(room('WC').queryByText('Libre')).not.toBeInTheDocument()
})

test('a Flatmate frees their own Occupancy', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await user.click((await findRoom('WC')).getByRole('button', { name: "J'occupe" }))

  await user.click(await room('WC').findByRole('button', { name: 'Je libère' }))

  expect(await room('WC').findByText('Libre')).toBeInTheDocument()
  expect(room('WC').queryByText(/Occupé par/)).not.toBeInTheDocument()
})

test("a Flatmate frees another Flatmate's Occupancy", async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await backend.occupy('salle-de-bain', LEA.id, clock.now())

  await user.click((await findRoom('Salle de bain')).getByRole('button', { name: 'Je libère' }))

  expect(await room('Salle de bain').findByText('Libre')).toBeInTheDocument()
})

test('an occupied Room cannot be occupied', async () => {
  const { backend } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await backend.occupy('wc', LEA.id, clock.now())

  expect(await (await findRoom('WC')).findByText('Occupé par Léa depuis 14:32')).toBeInTheDocument()
  expect(room('WC').queryByRole('button', { name: "J'occupe" })).not.toBeInTheDocument()
})

test('the two Rooms are independent', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  await user.click((await findRoom('WC')).getByRole('button', { name: "J'occupe" }))

  expect(await room('WC').findByText(/Occupé par Eliott/)).toBeInTheDocument()
  expect(room('Salle de bain').getByText('Libre')).toBeInTheDocument()

  await user.click(room('Salle de bain').getByRole('button', { name: "J'occupe" }))

  expect(await room('Salle de bain').findByText(/Occupée par Eliott/)).toBeInTheDocument()
  expect(room('WC').getByText(/Occupé par Eliott/)).toBeInTheDocument()
})

test('an Occupancy made by another Flatmate appears without reload', async () => {
  const { backend } = renderApp({ loggedInAs: ELIOTT.id, clock })
  expect((await findRoom('WC')).getByText('Libre')).toBeInTheDocument()

  await backend.occupy('wc', LEA.id, clock.now())

  expect(await room('WC').findByText('Occupé par Léa depuis 14:32')).toBeInTheDocument()
})

test('occupying a Room taken while the screen was out of date is refused', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock })
  const wc = await findRoom('WC')
  await backend.occupyUnannounced('wc', LEA.id, clock.now())

  await user.click(wc.getByRole('button', { name: "J'occupe" }))

  expect(await wc.findByRole('alert')).toHaveTextContent('WC déjà occupé par Léa.')
  expect(wc.queryByText(/Occupé par Eliott/)).not.toBeInTheDocument()
})
