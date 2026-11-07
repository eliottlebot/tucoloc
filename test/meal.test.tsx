import { act, screen, within } from '@testing-library/react'
import type { NewRecipe } from '../src/backend/Backend'
import { ELIOTT, LEA, renderApp, testClock } from './render'

const HOUR = 60 * 60 * 1000

const LEAS_CURRY: NewRecipe = { title: 'Curry', text: 'Lait de coco', link: null, photo: null, proteins: null, carbs: null, fats: null, creatorId: LEA.id }

const tonight = () => within(screen.getByRole('region', { name: 'Ce soir' }))

/** Opens the Repas tab at that moment, with Lea's Curry in the Recipes. */
async function openMealsAt(moment: string) {
  const clock = testClock(new Date(moment))
  const opened = renderApp({ loggedInAs: ELIOTT.id, clock })
  await opened.backend.createRecipe(LEAS_CURRY)
  await opened.user.click(await screen.findByRole('button', { name: 'Recettes' }))
  await screen.findByRole('button', { name: 'Curry' })
  return { ...opened, clock }
}

// 19:00 on 5 November 2026 in Paris (UTC+1)
const EVENING = '2026-11-05T18:00:00Z'

test('a Flatmate sets tonight’s Meal from a Recipe', async () => {
  const { user } = await openMealsAt(EVENING)
  expect(tonight().getByText('Rien de prevu.')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Curry' }))
  await user.click(screen.getByRole('button', { name: 'Choisir pour ce soir' }))

  expect(await tonight().findByRole('button', { name: 'Curry' })).toBeInTheDocument()
  expect(tonight().getByText('Choisi par Eliott a 19:00')).toBeInTheDocument()
})

test('a Flatmate sets tonight’s Meal as free text', async () => {
  const { user } = await openMealsAt(EVENING)

  await user.type(tonight().getByLabelText('Autre plat'), 'Pizza commandee')
  await user.click(tonight().getByRole('button', { name: 'Choisir' }))

  expect(await tonight().findByText('Pizza commandee')).toBeInTheDocument()
  expect(tonight().getByText('Choisi par Eliott a 19:00')).toBeInTheDocument()
})

async function chooseText(user: Awaited<ReturnType<typeof openMealsAt>>['user'], dish: string) {
  await user.type(tonight().getByLabelText('Autre plat'), dish)
  await user.click(tonight().getByRole('button', { name: 'Choisir' }))
  await tonight().findByText(dish)
}

test('choosing another Meal replaces it in one action', async () => {
  const { user } = await openMealsAt(EVENING)
  await chooseText(user, 'Pizza commandee')

  await chooseText(user, 'Restes')

  expect(tonight().queryByText('Pizza commandee')).not.toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('a Flatmate clears tonight’s Meal', async () => {
  const { user } = await openMealsAt(EVENING)
  await chooseText(user, 'Pizza commandee')

  await user.click(tonight().getByRole('button', { name: 'Effacer' }))

  expect(await tonight().findByText('Rien de prevu.')).toBeInTheDocument()
})

test('the Meal’s Recipe opens from the Meal', async () => {
  const { backend, user } = await openMealsAt(EVENING)
  const [curry] = await backend.listRecipes()
  await backend.setMeal({ recipeId: curry.id, text: null, setBy: LEA.id, setAt: new Date(EVENING) })

  await user.click(await tonight().findByRole('button', { name: 'Curry' }))

  expect(screen.getByRole('heading', { name: 'Curry' })).toBeInTheDocument()
  expect(screen.getByText('Lait de coco')).toBeInTheDocument()
})

test('a Meal set at 19:00 is still tonight’s at 5:59 the next day, and gone at 6:00', async () => {
  const { user, clock } = await openMealsAt(EVENING)
  await chooseText(user, 'Pizza commandee')

  act(() => clock.advance(10 * HOUR + 59 * 60 * 1000))
  expect(tonight().getByText('Pizza commandee')).toBeInTheDocument()

  act(() => clock.advance(60 * 1000))
  expect(tonight().getByText('Rien de prevu.')).toBeInTheDocument()
})

test('a Meal set at 7:00 is still tonight’s at 23:00 the same day', async () => {
  // 7:00 on 5 November 2026 in Paris
  const { user, clock } = await openMealsAt('2026-11-05T06:00:00Z')
  await chooseText(user, 'Soupe')

  act(() => clock.advance(16 * HOUR))

  expect(tonight().getByText('Soupe')).toBeInTheDocument()
})

test('6:00 is Paris time in summer too (UTC+2)', async () => {
  // 19:00 on 1 July 2026 in Paris
  const { user, clock } = await openMealsAt('2026-07-01T17:00:00Z')
  await chooseText(user, 'Salade')

  act(() => clock.advance(10 * HOUR + 59 * 60 * 1000))
  expect(tonight().getByText('Salade')).toBeInTheDocument()

  act(() => clock.advance(60 * 1000))
  expect(tonight().getByText('Rien de prevu.')).toBeInTheDocument()
})

test('a Meal set before 6:00 is over at 6:00 the same morning', async () => {
  // 1:00 on 6 November 2026 in Paris
  const { user, clock } = await openMealsAt('2026-11-06T00:00:00Z')
  await chooseText(user, 'Kebab')

  act(() => clock.advance(5 * HOUR))

  expect(tonight().getByText('Rien de prevu.')).toBeInTheDocument()
})

test('deleting the Meal’s Recipe empties the Meal', async () => {
  const { user } = await openMealsAt(EVENING)
  await user.click(screen.getByRole('button', { name: 'Curry' }))
  await user.click(screen.getByRole('button', { name: 'Choisir pour ce soir' }))
  await tonight().findByRole('button', { name: 'Curry' })

  await user.click(tonight().getByRole('button', { name: 'Curry' }))
  await user.click(screen.getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

  expect(await tonight().findByText('Rien de prevu.')).toBeInTheDocument()
})

test('a Meal set by another Flatmate appears without reload', async () => {
  const { backend } = await openMealsAt(EVENING)

  await backend.setMeal({ recipeId: null, text: 'Raclette', setBy: LEA.id, setAt: new Date(EVENING) })

  expect(await tonight().findByText('Raclette')).toBeInTheDocument()
  expect(tonight().getByText('Choisi par Lea a 19:00')).toBeInTheDocument()
})
