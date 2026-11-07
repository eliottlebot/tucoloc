import { act, screen, within } from '@testing-library/react'
import type { NewRecipe } from '../src/backend/Backend'
import { ELIOTT, LEA, renderApp, testClock } from './render'

const HOUR = 60 * 60 * 1000

const LEAS_CURRY: NewRecipe = { title: 'Curry', text: 'Lait de coco', link: null, photo: null, proteins: null, carbs: null, fats: null, creatorId: LEA.id }

const tonight = () => within(screen.getByRole('region', { name: 'Selection du jour' }))
/** No Meal: the field to type one is offered. */
const isEmpty = () => tonight().getByLabelText('Autre plat')

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
  expect(isEmpty()).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Choisir Curry pour ce soir' }))

  expect(await tonight().findByRole('button', { name: 'Curry' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /pour ce soir/ })).not.toBeInTheDocument()
  expect(tonight().queryByLabelText('Autre plat')).not.toBeInTheDocument()
})

test('a Flatmate sets tonight’s Meal as free text', async () => {
  const { user } = await openMealsAt(EVENING)

  await user.type(tonight().getByLabelText('Autre plat'), 'Pizza commandee')
  await user.click(tonight().getByRole('button', { name: 'Choisir' }))

  expect(await tonight().findByText('Pizza commandee')).toBeInTheDocument()
})

async function chooseText(user: Awaited<ReturnType<typeof openMealsAt>>['user'], dish: string) {
  await user.type(tonight().getByLabelText('Autre plat'), dish)
  await user.click(tonight().getByRole('button', { name: 'Choisir' }))
  await tonight().findByText(dish)
}

test('while a Meal is chosen, nothing else can be chosen until it is emptied', async () => {
  const { user } = await openMealsAt(EVENING)
  await chooseText(user, 'Pizza commandee')

  expect(tonight().queryByLabelText('Autre plat')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /pour ce soir/ })).not.toBeInTheDocument()

  await user.click(tonight().getByRole('button', { name: 'Effacer' }))
  await chooseText(user, 'Restes')

  expect(tonight().queryByText('Pizza commandee')).not.toBeInTheDocument()
})

test('emptying the Meal offers every choice again', async () => {
  const { user } = await openMealsAt(EVENING)
  await chooseText(user, 'Pizza commandee')

  await user.click(tonight().getByRole('button', { name: 'Effacer' }))

  expect(await tonight().findByLabelText('Autre plat')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Choisir Curry pour ce soir' })).toBeInTheDocument()
})

test('a Flatmate clears tonight’s Meal', async () => {
  const { user } = await openMealsAt(EVENING)
  await chooseText(user, 'Pizza commandee')

  await user.click(tonight().getByRole('button', { name: 'Effacer' }))

  expect(await tonight().findByLabelText('Autre plat')).toBeInTheDocument()
  expect(tonight().queryByText('Pizza commandee')).not.toBeInTheDocument()
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
  expect(isEmpty()).toBeInTheDocument()
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
  expect(isEmpty()).toBeInTheDocument()
})

test('a Meal set before 6:00 is over at 6:00 the same morning', async () => {
  // 1:00 on 6 November 2026 in Paris
  const { user, clock } = await openMealsAt('2026-11-06T00:00:00Z')
  await chooseText(user, 'Kebab')

  act(() => clock.advance(5 * HOUR))

  expect(isEmpty()).toBeInTheDocument()
})

test('deleting the Meal’s Recipe empties the Meal', async () => {
  const { user } = await openMealsAt(EVENING)
  await user.click(screen.getByRole('button', { name: 'Choisir Curry pour ce soir' }))
  await tonight().findByRole('button', { name: 'Curry' })

  await user.click(tonight().getByRole('button', { name: 'Curry' }))
  await user.click(screen.getByRole('button', { name: 'Supprimer' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }))

  expect(await tonight().findByLabelText('Autre plat')).toBeInTheDocument()
})

test('a Meal set by another Flatmate appears without reload', async () => {
  const { backend } = await openMealsAt(EVENING)

  await backend.setMeal({ recipeId: null, text: 'Raclette', setBy: LEA.id, setAt: new Date(EVENING) })

  expect(await tonight().findByText('Raclette')).toBeInTheDocument()
})
