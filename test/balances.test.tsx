import { screen } from '@testing-library/react'
import type { NewExpense } from '../src/backend/Backend'
import { ELIOTT, LEA, TOM, renderApp, testClock } from './render'

// 14:32 on 5 November 2026 in Paris
const clock = () => testClock(new Date('2026-11-05T13:32:00Z'))

const everyone = [ELIOTT.id, LEA.id, TOM.id]

const paid = (payerId: string, amountCents: number, participantIds: string[]): NewExpense => ({
  label: 'Dépense',
  amountCents,
  date: '2026-11-05',
  payerId,
  participantIds,
  creatorId: payerId,
  createdAt: new Date('2026-11-05T12:00:00Z'),
})

async function openExpensesWith(...expenses: NewExpense[]) {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await user.click(await screen.findByRole('tab', { name: 'Dépenses' }))
  await screen.findByRole('button', { name: 'Ajouter une dépense' })
  for (const expense of expenses) await backend.createExpense(expense)
  return user
}

/** fr-FR puts a narrow no-break space before €; read it as a plain space, as getByText does. */
const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ')
const balances = () => screen.getAllByRole('row').map((row) => [...row.children].map(text).join(' '))
const transfers = () => screen.queryAllByText(/ doit /).map(text)

test('one Expense shared by all three: the payer is owed the others’ shares', async () => {
  await openExpensesWith(paid(ELIOTT.id, 1260, everyone))

  await screen.findByText('Léa doit 4,20 € à Eliott')
  expect(balances()).toEqual(['Eliott +8,40 €', 'Léa -4,20 €', 'Tom -4,20 €'])
  expect(transfers()).toEqual(['Léa doit 4,20 € à Eliott', 'Tom doit 4,20 € à Eliott'])
})

test('Expenses shared by some Flatmates only count only for them', async () => {
  // Eliott pays 10,00 for Eliott and Léa (5,00 each); Tom pays 6,00 for Léa and Tom (3,00 each).
  await openExpensesWith(paid(ELIOTT.id, 1000, [ELIOTT.id, LEA.id]), paid(TOM.id, 600, [LEA.id, TOM.id]))

  await screen.findByText('Léa doit 5,00 € à Eliott')
  expect(balances()).toEqual(['Eliott +5,00 €', 'Léa -8,00 €', 'Tom +3,00 €'])
  expect(transfers()).toEqual(['Léa doit 5,00 € à Eliott', 'Léa doit 3,00 € à Tom'])
})

test('debts in both directions net out before suggesting transfers', async () => {
  // Eliott pays 9,00 for all three (3,00 each); Léa pays 6,00 for Eliott and Léa (3,00 each).
  // Eliott and Léa owe each other 3,00, which cancels: only Tom pays, once.
  await openExpensesWith(paid(ELIOTT.id, 900, everyone), paid(LEA.id, 600, [ELIOTT.id, LEA.id]))

  await screen.findByText('Tom doit 3,00 € à Eliott')
  expect(balances()).toEqual(['Eliott +3,00 €', 'Léa 0,00 €', 'Tom -3,00 €'])
  expect(transfers()).toEqual(['Tom doit 3,00 € à Eliott'])
})

test('when everyone paid their share, no transfer is suggested', async () => {
  await openExpensesWith(paid(ELIOTT.id, 3000, everyone), paid(LEA.id, 3000, everyone), paid(TOM.id, 3000, everyone))

  expect(await screen.findByText('Tout le monde est à jour.')).toBeInTheDocument()
  expect(balances()).toEqual(['Eliott 0,00 €', 'Léa 0,00 €', 'Tom 0,00 €'])
  expect(transfers()).toEqual([])
})

test('an amount that does not divide evenly still balances to the cent', async () => {
  // Tom pays 10,00 for all three: shares Eliott 3,34, Léa 3,33, Tom 3,33.
  await openExpensesWith(paid(TOM.id, 1000, everyone))

  await screen.findByText('Eliott doit 3,34 € à Tom')
  expect(balances()).toEqual(['Eliott -3,34 €', 'Léa -3,33 €', 'Tom +6,67 €'])
  expect(transfers()).toEqual(['Eliott doit 3,34 € à Tom', 'Léa doit 3,33 € à Tom'])
})

test('Balances follow an edited Expense', async () => {
  const user = await openExpensesWith()
  await user.click(screen.getByRole('button', { name: 'Ajouter une dépense' }))
  await user.type(screen.getByLabelText('Libellé'), 'Courses')
  await user.type(screen.getByLabelText('Montant (€)'), '12,60')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await screen.findByText('Léa doit 4,20 € à Eliott')

  await user.click(await screen.findByRole('button', { name: 'Modifier' }))
  await user.selectOptions(screen.getByLabelText('Payé par'), 'Tom')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByText('Eliott doit 4,20 € à Tom')).toBeInTheDocument()
  expect(balances()).toEqual(['Eliott -4,20 €', 'Léa -4,20 €', 'Tom +8,40 €'])
})
