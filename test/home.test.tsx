import { screen, within } from '@testing-library/react'
import type { NewRecipe } from '../src/backend/Backend'
import { ELIOTT, LEA, renderApp, testClock } from './render'

// 19:00 on 5 November 2026 in Paris
const EVENING = new Date('2026-11-05T18:00:00Z')

const SALADE: NewRecipe = { title: 'Salade verte', text: '', link: null, photo: null, proteins: 43, carbs: 160, fats: 20, creatorId: LEA.id }

const mealCard = () => within(screen.getByRole('region', { name: 'Recette du jour' }))
const findMealCard = async () => within(await screen.findByRole('region', { name: 'Recette du jour' }))

function openHome() {
  return renderApp({ loggedInAs: ELIOTT.id, clock: testClock(EVENING) })
}

test('the home screen shows tonight’s Recipe with its photo, who chose it and its values', async () => {
  const { backend } = openHome()
  const photo = await backend.uploadPhoto(new File(['jpeg'], 'salade.jpg', { type: 'image/jpeg' }))
  await backend.createRecipe({ ...SALADE, photo })
  const [salade] = await backend.listRecipes()

  await backend.setMeal({ recipeId: salade.id, text: null, setBy: LEA.id, setAt: EVENING })

  expect(await (await findMealCard()).findByText('Salade verte')).toBeInTheDocument()
  expect(mealCard().getByRole('img', { name: 'Salade verte' })).toHaveAttribute('src', expect.stringContaining('salade.jpg'))
  expect(mealCard().getByText('Choisie par Lea')).toBeInTheDocument()
  expect(mealCard().getByText('P: 43g G: 160g L: 20g')).toBeInTheDocument()
})

test('a free-text Meal shows on the home screen without a photo', async () => {
  const { backend } = openHome()

  await backend.setMeal({ recipeId: null, text: 'Pizza commandee', setBy: LEA.id, setAt: EVENING })

  expect(await (await findMealCard()).findByText('Pizza commandee')).toBeInTheDocument()
  expect(mealCard().getByText('Choisie par Lea')).toBeInTheDocument()
  expect(mealCard().queryByRole('img', { name: 'Pizza commandee' })).not.toBeInTheDocument()
})

test('without a Meal the home screen says no dish is chosen', async () => {
  openHome()

  expect((await findMealCard()).getByText('Aucun plat choisi')).toBeInTheDocument()
})
