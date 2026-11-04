import { screen } from '@testing-library/react'
import { ELIOTT, renderApp } from './render'

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
