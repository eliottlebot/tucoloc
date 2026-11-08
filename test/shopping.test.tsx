import { act, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { ELIOTT, renderApp, testClock } from './render'

const MINUTE = 60 * 1000

/** Names in the order shown. */
const items = () => within(screen.getByRole('list', { name: 'Liste de courses' })).queryAllByRole('listitem').map((li) => li.getAttribute('aria-label'))
const item = (name: string) => within(screen.getByRole('listitem', { name }))

async function openShopping() {
  const clock = testClock(new Date('2026-11-07T17:00:00Z'))
  const opened = renderApp({ loggedInAs: ELIOTT.id, clock })
  await opened.user.click(await screen.findByRole('button', { name: 'Courses' }))
  await screen.findByRole('list', { name: 'Liste de courses' })
  return { ...opened, clock }
}

async function add(user: UserEvent, name: string) {
  await user.type(screen.getByLabelText('Nouvel article'), name)
  await user.click(screen.getByRole('button', { name: 'Ajouter' }))
}

test('a Flatmate adds Items; an empty one is not added, accents are removed', async () => {
  const { user, clock } = await openShopping()

  await add(user, 'Carottes')
  act(() => clock.advance(MINUTE))
  await add(user, '   ')
  await add(user, 'Crème fraîche')

  await screen.findByRole('listitem', { name: 'Creme fraiche' })
  expect(items()).toEqual(['Carottes', 'Creme fraiche'])
  expect(screen.getByLabelText('Nouvel article')).toHaveValue('')
})

test('an Item added on another phone appears without reload', async () => {
  const { backend } = await openShopping()

  await backend.addShoppingItem({ name: 'Sopalin', addedAt: new Date('2026-11-07T16:00:00Z') })

  expect(await screen.findByRole('listitem', { name: 'Sopalin' })).toBeInTheDocument()
})

/** Adds the Items one minute apart, so their order is known. */
async function addAll(user: UserEvent, clock: ReturnType<typeof testClock>, ...names: string[]) {
  for (const name of names) {
    await add(user, name)
    await screen.findByRole('listitem', { name })
    act(() => clock.advance(MINUTE))
  }
}

/** Tapping an Item's name marks it bought. */
const buy = async (user: UserEvent, name: string) => {
  await user.click(item(name).getByRole('button', { name: `Marquer ${name} achete` }))
  await item(name).findByRole('button', { name: `Remettre ${name} a acheter` })
}

test('a bought Item goes after the Items to buy, in the order bought', async () => {
  const { user, clock } = await openShopping()
  await addAll(user, clock, 'Salade', 'Viande', 'Sopalin', 'Liquide vaisselle')

  await buy(user, 'Viande')
  act(() => clock.advance(MINUTE))
  await buy(user, 'Salade')

  expect(items()).toEqual(['Sopalin', 'Liquide vaisselle', 'Viande', 'Salade'])
})

test('tapping a bought Item puts it back to buy, in its place', async () => {
  const { user, clock } = await openShopping()
  await addAll(user, clock, 'Salade', 'Viande', 'Sopalin')
  await buy(user, 'Salade')

  await user.click(item('Salade').getByRole('button', { name: 'Remettre Salade a acheter' }))

  expect(await item('Salade').findByRole('button', { name: 'Marquer Salade achete' })).toBeInTheDocument()
  expect(items()).toEqual(['Salade', 'Viande', 'Sopalin'])
})

test('deleting an Item asks nothing', async () => {
  const { user, clock } = await openShopping()
  await addAll(user, clock, 'Salade', 'Viande')

  await user.click(item('Salade').getByRole('button', { name: 'Supprimer' }))

  await waitFor(() => expect(items()).toEqual(['Viande']))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('"all bought" asks first, then removes only the bought Items', async () => {
  const { user, clock } = await openShopping()
  const clear = () => screen.getByRole('button', { name: 'Vider les articles achetes' })
  await addAll(user, clock, 'Salade', 'Viande', 'Sopalin')
  expect(clear()).toBeDisabled()
  await buy(user, 'Salade')
  await buy(user, 'Sopalin')

  await user.click(clear())
  await user.click(within(screen.getByRole('alertdialog', { name: /Tout est achete \?/ })).getByRole('button', { name: 'Annuler' }))
  expect(items()).toEqual(['Viande', 'Salade', 'Sopalin'])

  await user.click(clear())
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Vider' }))

  await waitFor(() => expect(items()).toEqual(['Viande']))
  expect(clear()).toBeDisabled()
})

test('a line separates the Items to buy from the bought ones, only when there are both', async () => {
  const { user, clock } = await openShopping()
  await addAll(user, clock, 'Salade', 'Viande')
  expect(screen.queryByRole('separator')).not.toBeInTheDocument()

  await buy(user, 'Salade')

  const separator = screen.getByRole('separator')
  expect(separator.previousElementSibling).toHaveAccessibleName('Viande')
  expect(separator.nextElementSibling).toHaveAccessibleName('Salade')

  await buy(user, 'Viande')
  expect(screen.queryByRole('separator')).not.toBeInTheDocument()
})
