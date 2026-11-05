import { screen } from '@testing-library/react'
import { ELIOTT, NO_FLATMATE, renderApp } from './render'

test('a Flatmate logs in and sees the three tabs', async () => {
  const { user } = renderApp()

  await user.type(await screen.findByLabelText('Email'), ELIOTT.email)
  await user.type(screen.getByLabelText('Mot de passe'), ELIOTT.password)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))

  expect(await screen.findByRole('tab', { name: 'Pièces' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Dépenses' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Repas' })).toBeInTheDocument()
})

test('wrong credentials are refused with a French message', async () => {
  const { user } = renderApp()

  await user.type(await screen.findByLabelText('Email'), ELIOTT.email)
  await user.type(screen.getByLabelText('Mot de passe'), 'wrong')
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.')
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})

test('logging out returns to the login screen', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id })

  await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

  expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})

test('a Flatmate already logged in skips the login screen', async () => {
  renderApp({ loggedInAs: ELIOTT.id })

  expect(await screen.findByRole('tab', { name: 'Pièces' })).toBeInTheDocument()
  expect(screen.getByText('Eliott')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument()
})

test('an account with no Flatmate is refused with a French message', async () => {
  const { user } = renderApp()

  await user.type(await screen.findByLabelText('Email'), NO_FLATMATE.email)
  await user.type(screen.getByLabelText('Mot de passe'), NO_FLATMATE.password)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))

  expect(await screen.findByRole('alert')).toHaveTextContent("Ce compte n'est pas encore configuré dans Tucoloc.")
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
})

test('a session for an account with no Flatmate goes back to login with a French message', async () => {
  renderApp({ loggedInAs: NO_FLATMATE.id })

  expect(await screen.findByRole('alert')).toHaveTextContent("Ce compte n'est pas encore configuré dans Tucoloc.")
  expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
})

test('the no-Flatmate message is gone after a Flatmate logs in and out', async () => {
  const { user } = renderApp({ loggedInAs: NO_FLATMATE.id })
  await screen.findByRole('alert')

  await user.type(screen.getByLabelText('Email'), ELIOTT.email)
  await user.type(screen.getByLabelText('Mot de passe'), ELIOTT.password)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
  await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

  expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
