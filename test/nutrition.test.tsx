import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { ELIOTT, LEA, renderApp } from './render'

const recipes = () => within(screen.getByRole('list', { name: 'Recettes' }))

async function openRecipes() {
  const opened = renderApp({ loggedInAs: ELIOTT.id })
  await opened.user.click(await screen.findByRole('button', { name: 'Recettes' }))
  await screen.findByRole('button', { name: 'Ajouter une recette' })
  return opened
}

async function addRecipe(user: UserEvent, title: string, values: { proteins?: string; carbs?: string; fats?: string }) {
  await user.click(screen.getByRole('button', { name: 'Ajouter une recette' }))
  await user.type(screen.getByLabelText('Titre'), title)
  if (values.proteins) await user.type(screen.getByLabelText('Proteines (g)'), values.proteins)
  if (values.carbs) await user.type(screen.getByLabelText('Glucides (g)'), values.carbs)
  if (values.fats) await user.type(screen.getByLabelText('Lipides (g)'), values.fats)
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
}

test('a Recipe with its nutrition values shows them in the list and in the Recipe', async () => {
  const { user } = await openRecipes()

  await addRecipe(user, 'Salade verte', { proteins: '43', carbs: '160', fats: '20' })

  expect(await recipes().findByText('P: 43g G: 160g L: 20g')).toBeInTheDocument()
  await user.click(recipes().getByRole('button', { name: 'Salade verte' }))
  expect(screen.getByText('P: 43g G: 160g L: 20g')).toBeInTheDocument()
})

test('only the nutrition values given are shown', async () => {
  const { user } = await openRecipes()

  await addRecipe(user, 'Pain', { carbs: '50' })

  expect(await recipes().findByText('G: 50g')).toBeInTheDocument()
})

test('a Recipe without nutrition values shows none', async () => {
  const { user } = await openRecipes()

  await addRecipe(user, 'Restes', {})

  await recipes().findByRole('button', { name: 'Restes' })
  expect(screen.queryByText(/\d+g/)).not.toBeInTheDocument()
})

test('a Flatmate edits the nutrition values of a Recipe', async () => {
  const { backend, user } = await openRecipes()
  await backend.createRecipe({ title: 'Curry', text: '', link: null, photo: null, proteins: 30, carbs: null, fats: 12, creatorId: LEA.id })
  await user.click(await recipes().findByRole('button', { name: 'Curry' }))
  await user.click(screen.getByRole('button', { name: 'Modifier' }))
  expect(screen.getByLabelText('Proteines (g)')).toHaveValue('30')

  await user.clear(screen.getByLabelText('Proteines (g)'))
  await user.type(screen.getByLabelText('Proteines (g)'), '35')
  await user.type(screen.getByLabelText('Glucides (g)'), '80')
  await user.clear(screen.getByLabelText('Lipides (g)'))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByText('P: 35g G: 80g')).toBeInTheDocument()
})

test.each(['12,5', '-3', 'beaucoup'])('a nutrition value of %s is refused', async (value) => {
  const { backend, user } = await openRecipes()

  await addRecipe(user, 'Salade', { proteins: value })

  expect(await screen.findByRole('alert')).toHaveTextContent('Les valeurs nutritionnelles sont des grammes entiers (ex. 43).')
  expect(await backend.listRecipes()).toEqual([])
})
