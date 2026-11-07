import { screen, within } from '@testing-library/react'
import { ELIOTT, renderApp } from './render'

const NO_CONNECTION = 'Pas de connexion. Reessaie quand le reseau revient.'

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

  expect(await wc.findByText('Eliott')).toBeInTheDocument()
  expect(screen.queryByText(NO_CONNECTION)).not.toBeInTheDocument()
})

test('an Expense saved without connection says so and is not listed', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id })
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))
  await user.click(await screen.findByRole('button', { name: 'Ajouter une depense' }))
  await user.type(screen.getByLabelText('Titre'), 'Courses')
  await user.type(screen.getByLabelText('Prix'), '12,60')

  backend.goOffline()
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByText(NO_CONNECTION)).toBeInTheDocument()
  expect(screen.getByLabelText('Titre')).toHaveValue('Courses')
  expect(screen.queryByRole('listitem', { name: 'Courses' })).not.toBeInTheDocument()
})

test('freeing a Room without connection says so, and the Room stays occupied', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id })
  const wc = within(await screen.findByRole('region', { name: 'WC' }))
  await user.click(await wc.findByRole('button', { name: "J'occupe" }))
  await wc.findByText('Eliott')

  backend.goOffline()
  await user.click(wc.getByRole('button', { name: 'Je libere' }))

  expect(await screen.findByText(NO_CONNECTION)).toBeInTheDocument()
  expect(wc.getByText('Eliott')).toBeInTheDocument()
})
