import { screen, within } from '@testing-library/react'
import { ELIOTT, LEA, renderApp } from './render'

const recipes = () => within(screen.getByRole('list', { name: 'Recettes' }))
const photo = (name: string) => new File(['jpeg bytes'], name, { type: 'image/jpeg' })

async function openRecipes() {
  const opened = renderApp({ loggedInAs: ELIOTT.id })
  await opened.user.click(await screen.findByRole('button', { name: 'Recettes' }))
  await screen.findByRole('button', { name: 'Ajouter une recette' })
  return opened
}

test('a Flatmate adds a Recipe with a photo, shown in the list and in the Recipe', async () => {
  const { user } = await openRecipes()

  await user.click(screen.getByRole('button', { name: 'Ajouter une recette' }))
  await user.type(screen.getByLabelText('Titre'), 'Tarte aux poireaux')
  await user.upload(screen.getByLabelText('Photo'), photo('tarte.jpg'))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await recipes().findByRole('img', { name: 'Tarte aux poireaux' })).toHaveAttribute('src', expect.stringContaining('tarte.jpg'))
  await user.click(recipes().getByRole('button', { name: 'Tarte aux poireaux' }))
  expect(screen.getByRole('img', { name: 'Tarte aux poireaux' })).toHaveAttribute('src', expect.stringContaining('tarte.jpg'))
})

async function openLeasCurryWithPhoto() {
  const opened = await openRecipes()
  const curry = await opened.backend.uploadPhoto(photo('curry.jpg'))
  await opened.backend.createRecipe({ title: 'Curry', text: '', link: null, photo: curry, proteins: null, carbs: null, fats: null, creatorId: LEA.id })
  await opened.user.click(await recipes().findByRole('button', { name: 'Curry' }))
  await opened.user.click(screen.getByRole('button', { name: 'Modifier' }))
  return opened
}

test('a Flatmate replaces the photo of a Recipe', async () => {
  const { user } = await openLeasCurryWithPhoto()
  expect(screen.getByRole('img', { name: 'Photo actuelle' })).toHaveAttribute('src', expect.stringContaining('curry.jpg'))

  await user.upload(screen.getByLabelText('Photo'), photo('curry-2.jpg'))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('img', { name: 'Curry' })).toHaveAttribute('src', expect.stringContaining('curry-2.jpg'))
})

test('a Flatmate removes the photo of a Recipe', async () => {
  const { user } = await openLeasCurryWithPhoto()

  await user.click(screen.getByRole('button', { name: 'Retirer la photo' }))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  await screen.findByRole('heading', { name: 'Curry' })
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retour' }))
  expect(recipes().queryByRole('img')).not.toBeInTheDocument()
})

test('editing a Recipe without touching its photo keeps it', async () => {
  const { user } = await openLeasCurryWithPhoto()

  await user.type(screen.getByLabelText('Recette'), 'Lait de coco')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('img', { name: 'Curry' })).toHaveAttribute('src', expect.stringContaining('curry.jpg'))
})
