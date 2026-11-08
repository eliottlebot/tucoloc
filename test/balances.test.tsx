import { screen } from '@testing-library/react'
import type { NewExpense } from '../src/backend/Backend'
import { ELIOTT, LEA, TOM, renderApp, testClock, sentence } from './render'

// 14:32 on 5 November 2026 in Paris
const clock = () => testClock(new Date('2026-11-05T13:32:00Z'))

const everyone = [ELIOTT.id, LEA.id, TOM.id]

const paid = (payerId: string, amountCents: number, participantIds: string[]): NewExpense => ({
  label: 'Depense',
  amountCents,
  date: '2026-11-05',
  payerId,
  participantIds,
  creatorId: payerId,
  createdAt: new Date('2026-11-05T12:00:00Z'),
})

async function openExpensesWith(...expenses: NewExpense[]) {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))
  await screen.findByRole('button', { name: 'Ajouter une depense' })
  for (const expense of expenses) await backend.createExpense(expense)
  return user
}

/** fr-FR puts a narrow no-break space before €; read it as a plain space, as getByText does. */
const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ')
const balances = () => screen.getAllByRole('row').map((row) => [...row.children].map(text).join(' '))
const transfers = () => screen.queryAllByText(/ doit /).map(text)

test('one Expense shared by all three: the payer is owed the others’ shares', async () => {
  await openExpensesWith(paid(ELIOTT.id, 1260, everyone))

  await screen.findByText(sentence('Lea doit 4,20 € a Eliott'))
  expect(balances()).toEqual(['Eliott +8,40 €', 'Lea -4,20 €', 'Tom -4,20 €'])
  expect(transfers()).toEqual(['Lea doit 4,20 € a Eliott', 'Tom doit 4,20 € a Eliott'])
})

test('Expenses shared by some Flatmates only count only for them', async () => {
  // Eliott pays 10,00 for Eliott and Lea (5,00 each); Tom pays 6,00 for Lea and Tom (3,00 each).
  await openExpensesWith(paid(ELIOTT.id, 1000, [ELIOTT.id, LEA.id]), paid(TOM.id, 600, [LEA.id, TOM.id]))

  await screen.findByText(sentence('Lea doit 5,00 € a Eliott'))
  expect(balances()).toEqual(['Eliott +5,00 €', 'Lea -8,00 €', 'Tom +3,00 €'])
  expect(transfers()).toEqual(['Lea doit 5,00 € a Eliott', 'Lea doit 3,00 € a Tom'])
})

test('debts in both directions net out before suggesting transfers', async () => {
  // Eliott pays 9,00 for all three (3,00 each); Lea pays 6,00 for Eliott and Lea (3,00 each).
  // Eliott and Lea owe each other 3,00, which cancels: only Tom pays, once.
  await openExpensesWith(paid(ELIOTT.id, 900, everyone), paid(LEA.id, 600, [ELIOTT.id, LEA.id]))

  await screen.findByText(sentence('Tom doit 3,00 € a Eliott'))
  expect(balances()).toEqual(['Eliott +3,00 €', 'Lea 0,00 €', 'Tom -3,00 €'])
  expect(transfers()).toEqual(['Tom doit 3,00 € a Eliott'])
})

test('when everyone paid their share, no transfer is suggested', async () => {
  await openExpensesWith(paid(ELIOTT.id, 3000, everyone), paid(LEA.id, 3000, everyone), paid(TOM.id, 3000, everyone))

  expect(await screen.findByText('Tout le monde est a jour.')).toBeInTheDocument()
  expect(balances()).toEqual(['Eliott 0,00 €', 'Lea 0,00 €', 'Tom 0,00 €'])
  expect(transfers()).toEqual([])
})

test('an amount that does not divide evenly still balances to the cent', async () => {
  // Tom pays 10,00 for all three: shares Eliott 3,34, Lea 3,33, Tom 3,33.
  await openExpensesWith(paid(TOM.id, 1000, everyone))

  await screen.findByText(sentence('Eliott doit 3,34 € a Tom'))
  expect(balances()).toEqual(['Eliott -3,34 €', 'Lea -3,33 €', 'Tom +6,67 €'])
  expect(transfers()).toEqual(['Eliott doit 3,34 € a Tom', 'Lea doit 3,33 € a Tom'])
})

test('Balances follow an edited Expense', async () => {
  const user = await openExpensesWith()
  await user.click(screen.getByRole('button', { name: 'Ajouter une depense' }))
  await user.type(screen.getByLabelText('Titre'), 'Courses')
  await user.type(screen.getByLabelText('Prix'), '12,60')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await screen.findByText(sentence('Lea doit 4,20 € a Eliott'))

  await user.click(await screen.findByRole('button', { name: 'Modifier' }))
  await user.selectOptions(screen.getByLabelText('Acheteur'), 'Tom')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByText(sentence('Eliott doit 4,20 € a Tom'))).toBeInTheDocument()
  expect(balances()).toEqual(['Eliott -4,20 €', 'Lea -4,20 €', 'Tom +8,40 €'])
})
