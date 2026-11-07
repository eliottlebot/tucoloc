import { act, screen, waitFor, within } from '@testing-library/react'
import type { NewExpense } from '../src/backend/Backend'
import { ELIOTT, LEA, TOM, renderApp, testClock } from './render'

// 14:32 on 5 November 2026 in Paris
const clock = () => testClock(new Date('2026-11-05T13:32:00Z'))

const everyone = [ELIOTT.id, LEA.id, TOM.id]

/** Eliott paid 12,60 for all three, an hour before the clock starts. */
const COURSES: NewExpense = {
  label: 'Courses',
  amountCents: 1260,
  date: '2026-11-05',
  payerId: ELIOTT.id,
  participantIds: everyone,
  creatorId: ELIOTT.id,
  createdAt: new Date('2026-11-05T12:32:00Z'),
}

async function openExpensesWith(...expenses: NewExpense[]) {
  const testClock = clock()
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: testClock })
  for (const expense of expenses) await backend.createExpense(expense)
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))
  await screen.findByRole('button', { name: 'Ajouter une depense' })
  return { backend, user, clock: testClock }
}

/** fr-FR puts a narrow no-break space before €; read it as a plain space, as getByText does. */
const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ')
const balances = () => screen.getAllByRole('row').map((row) => [...row.children].map(text).join(' '))
const expense = (label: string) => within(screen.getByRole('listitem', { name: label }))

test('recording a Settlement asks first, then resets every Balance and settles earlier Expenses', async () => {
  const { user } = await openExpensesWith(COURSES)

  await user.click(screen.getByRole('button', { name: 'Enregistrer un reglement' }))
  const dialog = within(screen.getByRole('alertdialog', { name: /Enregistrer un reglement \?/ }))
  await user.click(dialog.getByRole('button', { name: 'Annuler' }))
  expect(balances()).toEqual(['Eliott +8,40 €', 'Lea -4,20 €', 'Tom -4,20 €'])

  await user.click(screen.getByRole('button', { name: 'Enregistrer un reglement' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByText('Tout le monde est a jour.')).toBeInTheDocument()
  expect(balances()).toEqual(['Eliott 0,00 €', 'Lea 0,00 €', 'Tom 0,00 €'])
  expect(expense('Courses').getByText('regle')).toBeInTheDocument()
})

const settleNow = async (user: Awaited<ReturnType<typeof openExpensesWith>>['user']) => {
  await user.click(screen.getByRole('button', { name: 'Enregistrer un reglement' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Enregistrer' }))
  await screen.findByText('Tout le monde est a jour.')
}

test('a settled Expense can be neither edited nor deleted', async () => {
  const { user } = await openExpensesWith(COURSES)
  expect(expense('Courses').getByRole('button', { name: 'Modifier' })).toBeInTheDocument()

  await settleNow(user)

  expect(expense('Courses').queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument()
  expect(expense('Courses').queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
})

test('an Expense entered after a Settlement but dated before it stays open and counts', async () => {
  const { user, clock } = await openExpensesWith(COURSES)
  await settleNow(user)
  act(() => clock.advance(60 * 60 * 1000))

  await user.click(screen.getByRole('button', { name: 'Ajouter une depense' }))
  await user.type(screen.getByLabelText('Titre'), 'Pain oublie')
  await user.type(screen.getByLabelText('Prix'), '3')
  await user.clear(screen.getByLabelText('Date'))
  await user.type(screen.getByLabelText('Date'), '2026-11-01')
  await user.selectOptions(screen.getByLabelText('Acheteur'), 'Tom')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  await screen.findByText('Eliott doit 1,00 € a Tom')
  expect(balances()).toEqual(['Eliott -1,00 €', 'Lea -1,00 €', 'Tom +2,00 €'])
  expect(expense('Pain oublie').queryByText('regle')).not.toBeInTheDocument()
  expect(expense('Pain oublie').getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
})

test('a Settlement is refused when every Balance is already zero', async () => {
  const { user } = await openExpensesWith()
  expect(screen.getByRole('button', { name: 'Enregistrer un reglement' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Enregistrer un reglement' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

const history = () => within(screen.getByRole('list', { name: 'Reglements' }))

test('the history lists each Settlement with its date, who recorded it and its transfers', async () => {
  const { user } = await openExpensesWith(COURSES)
  await settleNow(user)

  const [settlement] = history().getAllByRole('listitem')
  expect(within(settlement).getByText('5 nov. 2026')).toBeInTheDocument()
  expect(within(settlement).getByText('Enregistre par Eliott')).toBeInTheDocument()
  expect(within(settlement).getByText('Lea a paye 4,20 € a Eliott')).toBeInTheDocument()
  expect(within(settlement).getByText('Tom a paye 4,20 € a Eliott')).toBeInTheDocument()
})

/** Tom paid 3,00 for all three, at 14:00, between the two Settlements below. */
const PAIN: NewExpense = { ...COURSES, label: 'Pain', amountCents: 300, payerId: TOM.id, creatorId: TOM.id, createdAt: new Date('2026-11-05T13:00:00Z') }

/** Settles COURSES, at 13:45. */
const FIRST = {
  createdAt: new Date('2026-11-05T12:45:00Z'),
  creatorId: LEA.id,
  transfers: [{ fromId: LEA.id, toId: ELIOTT.id, cents: 420 }, { fromId: TOM.id, toId: ELIOTT.id, cents: 420 }],
}
/** Settles PAIN, at 14:15. */
const SECOND = {
  createdAt: new Date('2026-11-05T13:15:00Z'),
  creatorId: TOM.id,
  transfers: [{ fromId: ELIOTT.id, toId: TOM.id, cents: 100 }, { fromId: LEA.id, toId: TOM.id, cents: 100 }],
}

async function openWithTwoSettlements() {
  const opened = await openExpensesWith(COURSES, PAIN)
  await opened.backend.createSettlement(FIRST)
  await opened.backend.createSettlement(SECOND)
  await screen.findByText('Enregistre par Tom')
  return opened
}

const deleteSettlementRecordedBy = async (user: Awaited<ReturnType<typeof openExpensesWith>>['user'], name: string) => {
  const item = history().getAllByRole('listitem').find((li) => within(li).queryByText(`Enregistre par ${name}`))!
  await user.click(within(item).getByRole('button', { name: 'Supprimer' }))
  return within(screen.getByRole('alertdialog', { name: 'Supprimer le reglement du 5 nov. 2026 ?' }))
}

test('deleting the latest Settlement asks first, then reopens the Expenses it settled', async () => {
  const { user } = await openWithTwoSettlements()
  expect(expense('Pain').getByText('regle')).toBeInTheDocument()

  await user.click((await deleteSettlementRecordedBy(user, 'Tom')).getByRole('button', { name: 'Annuler' }))
  expect(history().getAllByRole('listitem')).toHaveLength(2)

  await user.click((await deleteSettlementRecordedBy(user, 'Tom')).getByRole('button', { name: 'Supprimer' }))

  await screen.findByText('Eliott doit 1,00 € a Tom')
  expect(balances()).toEqual(['Eliott -1,00 €', 'Lea -1,00 €', 'Tom +2,00 €'])
  expect(expense('Pain').queryByText('regle')).not.toBeInTheDocument()
  expect(expense('Courses').getByText('regle')).toBeInTheDocument()
  expect(history().getAllByRole('listitem')).toHaveLength(1)
})

test('deleting an older Settlement only removes it from the history', async () => {
  const { user } = await openWithTwoSettlements()

  await user.click((await deleteSettlementRecordedBy(user, 'Lea')).getByRole('button', { name: 'Supprimer' }))

  await waitFor(() => expect(screen.queryByText('Enregistre par Lea')).not.toBeInTheDocument())
  expect(history().getAllByRole('listitem')).toHaveLength(1)
  expect(balances()).toEqual(['Eliott 0,00 €', 'Lea 0,00 €', 'Tom 0,00 €'])
  expect(expense('Courses').getByText('regle')).toBeInTheDocument()
  expect(expense('Pain').getByText('regle')).toBeInTheDocument()
})

test('a Settlement counts the Expenses as they are when it is confirmed', async () => {
  const { backend, user } = await openExpensesWith(COURSES)
  await user.click(screen.getByRole('button', { name: 'Enregistrer un reglement' }))

  await backend.createExpense(PAIN)
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Enregistrer' }))

  await screen.findByText('Tout le monde est a jour.')
  const [settlement] = history().getAllByRole('listitem')
  // Courses: Eliott +8,40, Lea -4,20, Tom -4,20; Pain: Eliott -1,00, Lea -1,00, Tom +2,00.
  expect(within(settlement).getByText('Lea a paye 5,20 € a Eliott')).toBeInTheDocument()
  expect(within(settlement).getByText('Tom a paye 2,20 € a Eliott')).toBeInTheDocument()
})

test('confirming records nothing when another Flatmate settled in the meantime', async () => {
  const { backend, user } = await openExpensesWith(COURSES)
  await user.click(screen.getByRole('button', { name: 'Enregistrer un reglement' }))

  await backend.createSettlement({ ...FIRST, createdAt: new Date('2026-11-05T13:30:00Z') })
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Enregistrer' }))

  await screen.findByText('Tout le monde est a jour.')
  expect(history().getAllByRole('listitem')).toHaveLength(1)
})
