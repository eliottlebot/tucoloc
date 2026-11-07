import { screen, within } from '@testing-library/react'
import { ELIOTT, renderApp, testClock } from './render'

// 14:32 on 5 November 2026 in Paris
const clock = () => testClock(new Date('2026-11-05T13:32:00Z'))

test('an Expense label typed with accents is saved without them', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await user.click(await screen.findByRole('button', { name: 'Tricount' }))
  await user.click(await screen.findByRole('button', { name: 'Ajouter une depense' }))

  await user.type(screen.getByLabelText('Libelle'), 'Crème brûlée, œufs')
  await user.type(screen.getByLabelText('Montant (€)'), '9')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  expect(await screen.findByRole('listitem', { name: 'Creme brulee, oeufs' })).toBeInTheDocument()
  expect(await backend.listExpenses()).toMatchObject([{ label: 'Creme brulee, oeufs' }])
})

test('a Recipe and a free-text Meal typed with accents are saved without them', async () => {
  const { user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await user.click(await screen.findByRole('button', { name: 'Recettes' }))
  await user.click(await screen.findByRole('button', { name: 'Ajouter une recette' }))
  await user.type(screen.getByLabelText('Titre'), 'Pâtes à l’ail')
  await user.type(screen.getByLabelText('Recette'), 'Faire revenir à feu doux')
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

  await user.click(await screen.findByRole('button', { name: 'Pates a l’ail' }))
  expect(screen.getByText('Faire revenir a feu doux')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Retour' }))

  const tonight = within(screen.getByRole('region', { name: 'Selection du jour' }))
  await user.type(tonight.getByLabelText('Autre plat'), 'Gratin à la crème')
  await user.click(tonight.getByRole('button', { name: 'Choisir' }))
  expect(await tonight.findByText('Gratin a la creme')).toBeInTheDocument()
})

test('a date in December reads "dec."', async () => {
  const { backend, user } = renderApp({ loggedInAs: ELIOTT.id, clock: clock() })
  await backend.createExpense({
    label: 'Sapin',
    amountCents: 3000,
    date: '2026-12-03',
    payerId: ELIOTT.id,
    participantIds: [ELIOTT.id],
    creatorId: ELIOTT.id,
    createdAt: new Date('2026-11-05T13:00:00Z'),
  })

  await user.click(await screen.findByRole('button', { name: 'Tricount' }))

  expect(within(await screen.findByRole('listitem', { name: 'Sapin' })).getByText('3 dec. 2026')).toBeInTheDocument()
})
