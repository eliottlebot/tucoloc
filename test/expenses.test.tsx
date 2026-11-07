import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { ELIOTT, LEA, TOM, renderApp, testClock } from './render'

// 14:32 on 5 November 2026 in Paris
const clock = () => testClock(new Date('2026-11-05T13:32:00Z'))

const expense = async (label: string) => within(await screen.findByRole('listitem', { name: label }))

async function openNewExpense(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))
  await user.click(await screen.findByRole('button', { name: 'Ajouter une depense' }))
}

test('a Flatmate adds an Expense with the defaults', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await openNewExpense(user)

  await user.type(screen.getByLabelText('Libelle'), 'Courses')
  await user.type(screen.getByLabelText('Montant (€)'), '12,60')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  const courses = await expense('Courses')
  expect(courses.getByText('12,60 €')).toBeInTheDocument()
  expect(courses.getByText('5 nov. 2026')).toBeInTheDocument()
  expect(courses.getByText('Paye par Eliott')).toBeInTheDocument()
  expect(courses.getByText('Ajoutee par Eliott')).toBeInTheDocument()
  expect(courses.getByText('Eliott 4,20 € · Lea 4,20 € · Tom 4,20 €')).toBeInTheDocument()
})

test('a Flatmate adds an Expense someone else paid', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await openNewExpense(user)

  await user.type(screen.getByLabelText('Libelle'), 'Internet')
  await user.type(screen.getByLabelText('Montant (€)'), '30')
  await user.selectOptions(screen.getByLabelText('Paye par'), 'Lea')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  const internet = await expense('Internet')
  expect(internet.getByText('Paye par Lea')).toBeInTheDocument()
  expect(internet.getByText('Ajoutee par Eliott')).toBeInTheDocument()
})

test('a Flatmate adds an Expense shared by some Flatmates only', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await openNewExpense(user)

  await user.type(screen.getByLabelText('Libelle'), 'Cinema')
  await user.type(screen.getByLabelText('Montant (€)'), '12,60')
  const participants = within(screen.getByRole('group', { name: 'Participants' }))
  await user.click(participants.getByRole('checkbox', { name: 'Tom' }))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect((await expense('Cinema')).getByText('Eliott 6,30 € · Lea 6,30 €')).toBeInTheDocument()
})

test('a back-dated Expense is listed after more recent ones', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await openNewExpense(user)
  await user.type(screen.getByLabelText('Libelle'), 'Loyer')
  await user.type(screen.getByLabelText('Montant (€)'), '900')
  await user.clear(screen.getByLabelText('Date'))
  await user.type(screen.getByLabelText('Date'), '2026-10-01')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await user.click(await screen.findByRole('button', { name: 'Ajouter une depense' }))
  await user.type(screen.getByLabelText('Libelle'), 'Pain')
  await user.type(screen.getByLabelText('Montant (€)'), '3')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect((await expense('Loyer')).getByText('1 oct. 2026')).toBeInTheDocument()
  await expense('Pain')
  expect(screen.getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual(['Pain', 'Loyer'])
})

test('an Expense without a label is refused', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await openNewExpense(user)

  await user.type(screen.getByLabelText('Montant (€)'), '10')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Le libelle est obligatoire.')
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

test.each(['0', '0,00', '-5', '12,345', '99999999'])('an amount of %s € is refused', async (amount) => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await openNewExpense(user)

  await user.type(screen.getByLabelText('Libelle'), 'Rien')
  await user.type(screen.getByLabelText('Montant (€)'), amount)
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Indique un montant superieur a 0 (ex. 12,50).')
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

test('an Expense without participants is refused', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await openNewExpense(user)

  await user.type(screen.getByLabelText('Libelle'), 'Personne')
  await user.type(screen.getByLabelText('Montant (€)'), '10')
  const participants = within(screen.getByRole('group', { name: 'Participants' }))
  for (const name of ['Eliott', 'Lea', 'Tom']) await user.click(participants.getByRole('checkbox', { name }))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Choisis au moins un participant.')
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

test.each([
  ['10,00', 'Eliott 3,34 € · Lea 3,33 € · Tom 3,33 €'],
  ['10,01', 'Eliott 3,34 € · Lea 3,34 € · Tom 3,33 €'],
])('%s € split three ways gives shares that sum to the amount, extra cents in Flatmate order', async (amount, shares) => {
  const { user } = renderApp({ loggedInAs: TOM.id, clock: clock() })
  await openNewExpense(user)

  await user.type(screen.getByLabelText('Libelle'), 'Partage')
  await user.type(screen.getByLabelText('Montant (€)'), amount)
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect((await expense('Partage')).getByText(shares)).toBeInTheDocument()
})

test('an Expense added by another Flatmate appears without reload', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))
  await screen.findByRole('button', { name: 'Ajouter une depense' })

  await backend.createExpense({
    label: 'Lessive',
    amountCents: 899,
    date: '2026-11-04',
    payerId: LEA.id,
    participantIds: [ELIOTT.id, LEA.id, TOM.id],
    creatorId: LEA.id,
    createdAt: new Date('2026-11-05T13:00:00Z'),
  })

  const lessive = await expense('Lessive')
  expect(lessive.getByText('8,99 €')).toBeInTheDocument()
  expect(lessive.getByText('4 nov. 2026')).toBeInTheDocument()
  expect(lessive.getByText('Ajoutee par Lea')).toBeInTheDocument()
})

test('an Expense without a date is refused', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await openNewExpense(user)

  await user.type(screen.getByLabelText('Libelle'), 'Sans date')
  await user.type(screen.getByLabelText('Montant (€)'), '10')
  await user.clear(screen.getByLabelText('Date'))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('La date est obligatoire.')
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

const LEAS_COURSES = {
  label: 'Courses',
  amountCents: 1260,
  date: '2026-11-04',
  payerId: LEA.id,
  participantIds: [ELIOTT.id, LEA.id, TOM.id],
  creatorId: LEA.id,
  createdAt: new Date('2026-11-04T18:00:00Z'),
}

test('a Flatmate edits an Expense another Flatmate added', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await backend.createExpense(LEAS_COURSES)
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))

  await user.click((await expense('Courses')).getByRole('button', { name: 'Modifier' }))
  await user.clear(screen.getByLabelText('Libelle'))
  await user.type(screen.getByLabelText('Libelle'), 'Marche')
  await user.clear(screen.getByLabelText('Montant (€)'))
  await user.type(screen.getByLabelText('Montant (€)'), '9,00')
  await user.clear(screen.getByLabelText('Date'))
  await user.type(screen.getByLabelText('Date'), '2026-11-03')
  await user.selectOptions(screen.getByLabelText('Paye par'), 'Tom')
  await user.click(within(screen.getByRole('group', { name: 'Participants' })).getByRole('checkbox', { name: 'Eliott' }))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  const marche = await expense('Marche')
  expect(marche.getByText('9,00 €')).toBeInTheDocument()
  expect(marche.getByText('3 nov. 2026')).toBeInTheDocument()
  expect(marche.getByText('Paye par Tom')).toBeInTheDocument()
  expect(marche.getByText('Ajoutee par Lea')).toBeInTheDocument()
  expect(marche.getByText('Lea 4,50 € · Tom 4,50 €')).toBeInTheDocument()
  expect(screen.queryByRole('listitem', { name: 'Courses' })).not.toBeInTheDocument()
})

test('editing an Expense starts from its current values and is validated', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await backend.createExpense(LEAS_COURSES)
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))

  await user.click((await expense('Courses')).getByRole('button', { name: 'Modifier' }))
  expect(screen.getByLabelText('Montant (€)')).toHaveValue('12,60')
  expect(screen.getByLabelText('Date')).toHaveValue('2026-11-04')
  expect(screen.getByLabelText('Paye par')).toHaveDisplayValue('Lea')
  await user.clear(screen.getByLabelText('Libelle'))
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Le libelle est obligatoire.')
  expect(await backend.listExpenses()).toMatchObject([{ label: 'Courses' }])
})

test('deleting an Expense asks first; cancelling keeps it', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await backend.createExpense(LEAS_COURSES)
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))

  await user.click((await expense('Courses')).getByRole('button', { name: 'Supprimer' }))
  const dialog = within(screen.getByRole('alertdialog', { name: 'Supprimer la depense "Courses" ?' }))
  await user.click(dialog.getByRole('button', { name: 'Annuler' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(await expense('Courses')).toBeTruthy()
})

test('confirming the delete removes the Expense', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await backend.createExpense(LEAS_COURSES)
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))

  await user.click((await expense('Courses')).getByRole('button', { name: 'Supprimer' }))
  const dialog = within(screen.getByRole('alertdialog', { name: 'Supprimer la depense "Courses" ?' }))
  await user.click(dialog.getByRole('button', { name: 'Supprimer' }))

  await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Courses' })).not.toBeInTheDocument())
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
