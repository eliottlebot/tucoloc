import { screen, within } from '@testing-library/react'
import { ELIOTT, renderApp } from './render'

const NO_CONNECTION = 'Pas de connexion. Réessaie quand le réseau revient.'

test('occupying a Room without connection says so, and the Room stays free', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id })
  const wc = within(await screen.findByRole('region', { name: 'WC' }))
  await wc.findByText('Libre')

  backend.goOffline()
  await user.click(wc.getByRole('button', { name: "J'occupe" }))

  expect(await screen.findByRole('alert')).toHaveTextContent(NO_CONNECTION)
  expect(wc.getByText('Libre')).toBeInTheDocument()
})

test('the message goes away once a later call gets through', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id })
  const wc = within(await screen.findByRole('region', { name: 'WC' }))
  await wc.findByText('Libre')
  backend.goOffline()
  await user.click(wc.getByRole('button', { name: "J'occupe" }))
  await screen.findByText(NO_CONNECTION)

  backend.goOnline()
  await user.click(wc.getByRole('button', { name: "J'occupe" }))

  expect(await wc.findByText(/Occupé par Eliott/)).toBeInTheDocument()
  expect(screen.queryByText(NO_CONNECTION)).not.toBeInTheDocument()
})

test('an Expense saved without connection says so and is not listed', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id })
  await user.click(await screen.findByRole('tab', { name: 'Dépenses' }))
  await user.click(await screen.findByRole('button', { name: 'Ajouter une dépense' }))
  await user.type(screen.getByLabelText('Libellé'), 'Courses')
  await user.type(screen.getByLabelText('Montant (€)'), '12,60')

  backend.goOffline()
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByText(NO_CONNECTION)).toBeInTheDocument()
  expect(screen.getByLabelText('Libellé')).toHaveValue('Courses')
  expect(screen.queryByRole('listitem', { name: 'Courses' })).not.toBeInTheDocument()
})

test('freeing a Room without connection says so, and the Room stays occupied', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id })
  const wc = within(await screen.findByRole('region', { name: 'WC' }))
  await user.click(await wc.findByRole('button', { name: "J'occupe" }))
  await wc.findByText(/Occupé par Eliott/)

  backend.goOffline()
  await user.click(wc.getByRole('button', { name: 'Je libère' }))

  expect(await screen.findByText(NO_CONNECTION)).toBeInTheDocument()
  expect(wc.getByText(/Occupé par Eliott/)).toBeInTheDocument()
})
