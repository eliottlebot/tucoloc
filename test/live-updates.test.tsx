import { screen } from '@testing-library/react'
import { ELIOTT, renderApp } from './render'

test('a change made elsewhere reaches the screen without reload', async () => {
  const { backend } = renderApp({ loggedInAs: ELIOTT.id })
  expect(await screen.findByText('Eliott')).toBeInTheDocument()

  await backend.renameFlatmate(ELIOTT.id, 'Eliott S.')

  expect(await screen.findByText('Eliott S.')).toBeInTheDocument()
})
