import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { ELIOTT, LEA, renderApp } from './render'

const recipes = () => within(screen.getByRole('list', { name: 'Recettes' }))

async function openRecipes() {
  const opened = renderApp({ loggedInAs: ELIOTT.id })
  await opened.user.click(await screen.findByRole('tab', { name: 'Repas' }))
  await screen.findByRole('button', { name: 'Ajouter une recette' })
  return opened
}

async function addRecipe(user: UserEvent, fields: { title: string; text?: string; link?: string }) {
  await user.click(screen.getByRole('button', { name: 'Ajouter une recette' }))
  await user.type(screen.getByLabelText('Titre'), fields.title)
  if (fields.text) await user.type(screen.getByLabelText('Recette'), fields.text)
  if (fields.link) await user.type(screen.getByLabelText('Lien'), fields.link)
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
}

test('a Flatmate adds a Recipe with only a title', async () => {
  const { user } = await openRecipes()

  await addRecipe(user, { title: 'Tarte aux poireaux' })

  expect(await recipes().findByRole('button', { name: 'Tarte aux poireaux' })).toBeInTheDocument()
})

test('a Recipe without a title is refused', async () => {
  const { backend, user } = await openRecipes()

  await addRecipe(user, { title: '   ', text: 'Des poireaux' })

  expect(await screen.findByRole('alert')).toHaveTextContent('Le titre est obligatoire.')
  expect(await backend.listRecipes()).toEqual([])
})

test('a link that is not a web address is refused', async () => {
  const { backend, user } = await openRecipes()

  await addRecipe(user, { title: 'Tarte', link: 'javascript:alert(1)' })

  expect(await screen.findByRole('alert')).toHaveTextContent('Le lien doit commencer par http:// ou https://.')
  expect(await backend.listRecipes()).toEqual([])
})

test('a Flatmate opens a Recipe to read its full text and follow its link', async () => {
  const { user } = await openRecipes()
  await addRecipe(user, {
    title: 'Tarte aux poireaux',
    text: 'Pâte brisée{enter}3 poireaux{enter}Cuire 35 min à 180 °C',
    link: 'https://cuisine.example/tarte',
  })

  await user.click(await recipes().findByRole('button', { name: 'Tarte aux poireaux' }))

  expect(screen.getByRole('heading', { name: 'Tarte aux poireaux' })).toBeInTheDocument()
  expect(screen.getByText(/Cuire 35 min à 180 °C/)).toHaveTextContent('Pâte brisée 3 poireaux Cuire 35 min à 180 °C')
  expect(screen.getByRole('link', { name: 'https://cuisine.example/tarte' })).toHaveAttribute('href', 'https://cuisine.example/tarte')
  expect(screen.getByText('Ajoutée par Eliott')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Retour' }))
  expect(recipes().getByRole('button', { name: 'Tarte aux poireaux' })).toBeInTheDocument()
})

const LEAS_CURRY = { title: 'Curry', text: 'Lait de coco', link: null, photo: null, creatorId: LEA.id }

test('a Flatmate edits a Recipe another Flatmate added', async () => {
  const { backend, user } = await openRecipes()
  await backend.createRecipe(LEAS_CURRY)
  await user.click(await recipes().findByRole('button', { name: 'Curry' }))

  await user.click(screen.getByRole('button', { name: 'Modifier' }))
  expect(screen.getByLabelText('Recette')).toHaveValue('Lait de coco')
  await user.clear(screen.getByLabelText('Titre'))
  await user.type(screen.getByLabelText('Titre'), 'Curry de légumes')
  await user.type(screen.getByLabelText('Recette'), ', pois chiches')
  await user.type(screen.getByLabelText('Lien'), 'https://cuisine.example/curry')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('heading', { name: 'Curry de légumes' })).toBeInTheDocument()
  expect(screen.getByText('Lait de coco, pois chiches')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'https://cuisine.example/curry' })).toBeInTheDocument()
  expect(screen.getByText('Ajoutée par Léa')).toBeInTheDocument()
})

test('deleting a Recipe asks first; cancelling keeps it, confirming removes it', async () => {
  const { backend, user } = await openRecipes()
  await backend.createRecipe(LEAS_CURRY)
  await user.click(await recipes().findByRole('button', { name: 'Curry' }))

  await user.click(screen.getByRole('button', { name: 'Supprimer' }))
  await user.click(
    within(screen.getByRole('alertdialog', { name: 'Supprimer la recette « Curry » ?' })).getByRole('button', { name: 'Annuler' }),
  )
  expect(screen.getByRole('heading', { name: 'Curry' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

  await screen.findByRole('button', { name: 'Ajouter une recette' })
  expect(recipes().queryByRole('button', { name: 'Curry' })).not.toBeInTheDocument()
})

test('a Recipe added by another Flatmate appears without reload', async () => {
  const { backend } = await openRecipes()

  await backend.createRecipe(LEAS_CURRY)

  expect(await recipes().findByRole('button', { name: 'Curry' })).toBeInTheDocument()
})

test('a delete left pending when another Flatmate deleted that Recipe does not carry over', async () => {
  const { backend, user } = await openRecipes()
  await backend.createRecipe(LEAS_CURRY)
  await backend.createRecipe({ ...LEAS_CURRY, title: 'Gratin' })
  await user.click(await recipes().findByRole('button', { name: 'Curry' }))
  await user.click(screen.getByRole('button', { name: 'Supprimer' }))

  const curry = (await backend.listRecipes()).find((r) => r.title === 'Curry')!
  await backend.deleteRecipe(curry.id)
  await screen.findByRole('button', { name: 'Ajouter une recette' })
  await user.click(recipes().getByRole('button', { name: 'Gratin' }))

  expect(screen.getByRole('heading', { name: 'Gratin' })).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
