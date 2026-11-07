import { screen, within } from '@testing-library/react'
import { ELIOTT, renderApp } from './render'

test('the app opens on the home screen, under a header with the Flatmate’s name', async () => {
  renderApp({ loggedInAs: ELIOTT.id })

  expect(await screen.findByRole('region', { name: 'WC' })).toBeInTheDocument()
  expect(within(screen.getByRole('banner')).getByText('ELIOTT')).toBeInTheDocument()
  expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Se deconnecter' })).toBeInTheDocument()
})

test('the bottom bar leads to Tricount and Recettes, the header back home', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id })
  const bar = within(await screen.findByRole('navigation'))

  await user.click(bar.getByRole('button', { name: 'Tricount' }))
  expect(await screen.findByRole('button', { name: 'Ajouter une depense' })).toBeInTheDocument()

  await user.click(bar.getByRole('button', { name: 'Recettes' }))
  expect(await screen.findByRole('button', { name: 'Ajouter une recette' })).toBeInTheDocument()

  await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'ELIOTT, accueil' }))
  expect(await screen.findByRole('region', { name: 'WC' })).toBeInTheDocument()
})
