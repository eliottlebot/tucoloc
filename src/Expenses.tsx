import { useState, type FormEvent } from 'react'
import type { Backend, Day, Expense, Flatmate, Settlement, Transfer } from './backend/Backend'
import type { Clock } from './clock'
import { ConfirmDialog } from './ConfirmDialog'
import { CircleCheckIcon, CirclePlusIcon, CircleXIcon, PencilIcon, ScaleIcon } from './icons'
import { plain } from './plain'
import { useLive } from './useLive'

/** "12,50 €"; with signDisplay 'exceptZero', "+12,50 €" and "-12,50 €". */
const formatEuros = (cents: number, signDisplay: Intl.NumberFormatOptions['signDisplay'] = 'auto') =>
  (cents / 100)
    .toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', signDisplay })
    // The design font has no narrow no-break space; a plain no-break one keeps "12,50 €" on one line.
    .replace(/\u202f/g, '\u00a0')

/** Cents as form input text: "12,50", without the € sign. */
const toAmountInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

/** "3 dec. 2026": French short months, without accents for the design font. */
const formatDay = (day: Day) =>
  plain(new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }))

/** The date in Paris at that moment, as a Day. */
const dayInParis = (moment: Date): Day => moment.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

/** "12,50" or "12.50" to cents; null when it isn't an amount. At most 7 digits of euros, to fit an SQL integer. */
function parseEuros(text: string): number | null {
  const match = text.trim().match(/^(\d{1,7})(?:[.,](\d{1,2}))?$/)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

/**
 * Equal shares in cents: each participant gets the amount divided by their count, rounded down,
 * and the leftover cents go one each to participants in id order, so the shares sum to the amount.
 */
function splitEqually(amountCents: number, participantIds: string[]) {
  const ids = [...participantIds].sort()
  const base = Math.floor(amountCents / ids.length)
  const leftover = amountCents - base * ids.length
  return ids.map((flatmateId, i) => ({ flatmateId, cents: base + (i < leftover ? 1 : 0) }))
}

/** Per Flatmate, in cents: what they paid minus their shares. Positive is owed, negative owes; they sum to zero. */
function balances(expenses: Expense[], flatmates: Flatmate[]) {
  const cents = new Map(flatmates.map((f) => [f.id, 0]))
  for (const e of expenses) {
    cents.set(e.payerId, cents.get(e.payerId)! + e.amountCents)
    for (const s of splitEqually(e.amountCents, e.participantIds)) cents.set(s.flatmateId, cents.get(s.flatmateId)! - s.cents)
  }
  return flatmates.map((f) => ({ flatmateId: f.id, cents: cents.get(f.id)! }))
}

/**
 * Transfers that zero every Balance: the largest debtor pays the largest creditor, until none is left.
 * With three Flatmates that is at most two transfers. Ties go to the first in Flatmate order.
 */
function suggestedTransfers(perFlatmate: { flatmateId: string; cents: number }[]) {
  const left = perFlatmate.map((b) => ({ ...b }))
  const transfers: Transfer[] = []
  for (;;) {
    const debtor = left.reduce((a, b) => (b.cents < a.cents ? b : a))
    const creditor = left.reduce((a, b) => (b.cents > a.cents ? b : a))
    if (debtor.cents === 0) return transfers
    const cents = Math.min(-debtor.cents, creditor.cents)
    transfers.push({ fromId: debtor.flatmateId, toId: creditor.flatmateId, cents })
    debtor.cents += cents
    creditor.cents -= cents
  }
}

/** Settled: created before the latest Settlement, so a back-dated Expense entered afterwards stays open. */
function isSettledBy(settlements: Settlement[]) {
  const settledUntil = Math.max(0, ...settlements.map((s) => s.createdAt.getTime()))
  return (e: Expense) => e.createdAt.getTime() < settledUntil
}

const latestFirst = (a: Settlement, b: Settlement) => b.createdAt.getTime() - a.createdAt.getTime()

/** Newest date first; same date, last entered first. */
const newestFirst = (a: Expense, b: Expense) =>
  b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime()

type Props = { backend: Backend; clock: Clock; me: Flatmate; flatmates: Flatmate[] | undefined }

/** What the ConfirmDialog asks, and what confirming does. */
type Confirmation = { question: string; confirmLabel: string; action: () => Promise<void> }

export function Expenses({ backend, clock, me, flatmates }: Props) {
  const expenses = useLive(backend, 'expenses', () => backend.listExpenses())
  const settlements = useLive(backend, 'settlements', () => backend.listSettlements())
  // The form is closed, adding a new Expense, or editing this one.
  const [form, setForm] = useState<'closed' | 'new' | Expense>('closed')
  const [confirming, setConfirming] = useState<Confirmation | null>(null)
  if (!expenses || !settlements || !flatmates) return null

  const nameOf = (id: string) => flatmates.find((f) => f.id === id)!.name
  const isSettled = isSettledBy(settlements)

  if (form !== 'closed')
    return (
      <ExpenseForm
        backend={backend}
        clock={clock}
        me={me}
        flatmates={flatmates}
        editing={form === 'new' ? undefined : form}
        onDone={() => setForm('closed')}
      />
    )

  return (
    <>
      <h2>Tricount</h2>
      <Balances
        expenses={expenses.filter((e) => !isSettled(e))}
        flatmates={flatmates}
        nameOf={nameOf}
        onSettle={() =>
          setConfirming({
            question: 'Enregistrer un reglement ? Chaque solde repassera a 0,00 €.',
            confirmLabel: 'Enregistrer',
            action: async () => {
              // Worked out again on confirm: another phone may have added an Expense or settled meanwhile.
              const [expenses, settlements] = await Promise.all([backend.listExpenses(), backend.listSettlements()])
              const isSettled = isSettledBy(settlements)
              const transfers = suggestedTransfers(balances(expenses.filter((e) => !isSettled(e)), flatmates))
              if (transfers.length > 0) await backend.createSettlement({ createdAt: clock.now(), creatorId: me.id, transfers })
            },
          })
        }
      />
      <h2>Depenses</h2>
      <ul className="card-list">
        {[...expenses].sort(newestFirst).map((e) => (
          <ExpenseItem
            key={e.id}
            expense={e}
            flatmates={flatmates}
            nameOf={nameOf}
            settled={isSettled(e)}
            onEdit={() => setForm(e)}
            onDelete={() =>
              setConfirming({
                question: `Supprimer la depense "${e.label}" ?`,
                confirmLabel: 'Supprimer',
                action: () => backend.deleteExpense(e.id),
              })
            }
          />
        ))}
      </ul>
      {settlements.length > 0 && (
        <SettlementHistory
          settlements={settlements}
          nameOf={nameOf}
          onDelete={(s) =>
            setConfirming({
              question: `Supprimer le reglement du ${formatDay(dayInParis(s.createdAt))} ?`,
              confirmLabel: 'Supprimer',
              action: () => backend.deleteSettlement(s.id),
            })
          }
        />
      )}
      <button className="action-button fab" aria-label="Ajouter une depense" onClick={() => setForm('new')}>
        <CirclePlusIcon />
      </button>
      {confirming && (
        <ConfirmDialog
          question={confirming.question}
          confirmLabel={confirming.confirmLabel}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            setConfirming(null)
            await confirming.action()
          }}
        />
      )}
    </>
  )
}

type BalancesProps = {
  /** The open Expenses, not yet settled. */
  expenses: Expense[]
  flatmates: Flatmate[]
  nameOf: (id: string) => string
  onSettle: () => void
}

function Balances({ expenses, flatmates, nameOf, onSettle }: BalancesProps) {
  const perFlatmate = balances(expenses, flatmates)
  const transfers = suggestedTransfers(perFlatmate)
  return (
    <>
      <section aria-label="Soldes" className="card balances">
        <table>
          <tbody>
            {perFlatmate.map((b) => (
              <tr key={b.flatmateId}>
                <th scope="row">{nameOf(b.flatmateId)}</th>
                <td className={b.cents > 0 ? 'owed' : b.cents < 0 ? 'owes' : undefined}>{formatEuros(b.cents, 'exceptZero')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="card-icon" aria-label="Enregistrer un reglement" disabled={transfers.length === 0} onClick={onSettle}>
          <ScaleIcon />
        </button>
      </section>
      <h2>Virements</h2>
      <section aria-label="Virements" className="card transfers">
        {transfers.length === 0 ? (
          <p>Tout le monde est a jour.</p>
        ) : (
          transfers.map((t) => (
            <p key={t.fromId + t.toId}>
              {nameOf(t.fromId)} doit <span className="price">{formatEuros(t.cents)}</span> a {nameOf(t.toId)}
            </p>
          ))
        )}
      </section>
    </>
  )
}

type HistoryProps = { settlements: Settlement[]; nameOf: (id: string) => string; onDelete: (s: Settlement) => void }

function SettlementHistory({ settlements, nameOf, onDelete }: HistoryProps) {
  return (
    <>
      <h2>Reglements</h2>
      <ul className="card-list" aria-label="Reglements">
        {[...settlements].sort(latestFirst).map((s) => (
          <li key={s.id} className="card">
            {s.transfers.map((t) => (
              <p key={t.fromId + t.toId}>
                {nameOf(t.fromId)} a paye <span className="price">{formatEuros(t.cents)}</span> a {nameOf(t.toId)}
              </p>
            ))}
            <p className="card-detail">
              <span>{formatDay(dayInParis(s.createdAt))}</span> · <span>Enregistre par {nameOf(s.creatorId)}</span>
            </p>
            <div className="card-actions">
              <button className="action-button" aria-label="Supprimer" onClick={() => onDelete(s)}>
                <CircleXIcon />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

type ItemProps = {
  expense: Expense
  flatmates: Flatmate[]
  nameOf: (id: string) => string
  settled: boolean
  onEdit: () => void
  onDelete: () => void
}

function ExpenseItem({ expense, flatmates, nameOf, settled, onEdit, onDelete }: ItemProps) {
  const split = splitEqually(expense.amountCents, expense.participantIds)
  // Shown in the usual Flatmate order, whatever order the leftover cents followed.
  const shares = flatmates.flatMap((f) => split.filter((s) => s.flatmateId === f.id))
  return (
    <li aria-label={expense.label} className="card expense">
      <p>
        <span>{expense.label}</span> - <span>{formatEuros(expense.amountCents)}</span>
      </p>
      <p>{formatDay(expense.date)}</p>
      <p>Paye par {nameOf(expense.payerId)}</p>
      <p className="card-detail">{shares.map((s) => `${nameOf(s.flatmateId)} ${formatEuros(s.cents)}`).join(' · ')}</p>
      <p className="card-detail">
        <span>Ajoutee par {nameOf(expense.creatorId)}</span>
        {settled && (
          <>
            {' · '}
            <span>regle</span>
          </>
        )}
      </p>
      {!settled && (
        <div className="card-actions">
          <button className="action-button" aria-label="Modifier" onClick={onEdit}>
            <PencilIcon />
          </button>
          <button className="action-button" aria-label="Supprimer" onClick={onDelete}>
            <CircleXIcon />
          </button>
        </div>
      )}
    </li>
  )
}

type FormProps = {
  backend: Backend
  clock: Clock
  me: Flatmate
  flatmates: Flatmate[]
  /** The Expense being edited; a new Expense when absent. */
  editing?: Expense
  onDone: () => void
}

function ExpenseForm({ backend, clock, me, flatmates, editing, onDone }: FormProps) {
  const [label, setLabel] = useState(editing?.label ?? '')
  const [amount, setAmount] = useState(editing ? toAmountInput(editing.amountCents) : '')
  const [date, setDate] = useState(() => editing?.date ?? dayInParis(clock.now()))
  const [payerId, setPayerId] = useState(editing?.payerId ?? me.id)
  const [participantIds, setParticipantIds] = useState(editing?.participantIds ?? flatmates.map((f) => f.id))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) =>
    setParticipantIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amountCents = parseEuros(amount)
    if (!label.trim()) return setError('Le titre est obligatoire.')
    if (!amountCents) return setError('Indique un prix superieur a 0 (ex. 12,50).')
    if (!date) return setError('La date est obligatoire.')
    if (participantIds.length === 0) return setError('Choisis au moins un participant.')
    setSaving(true)
    const changes = { label: plain(label.trim()), amountCents, date, payerId, participantIds }
    if (editing) await backend.updateExpense(editing.id, changes)
    else await backend.createExpense({ ...changes, creatorId: me.id, createdAt: clock.now() })
    onDone()
  }

  return (
    <form className="expense-form" onSubmit={submit}>
      <div className="screen-actions">
        <button type="button" className="action-button" aria-label="Annuler" onClick={onDone}>
          <CircleXIcon />
        </button>
        <button type="submit" className="action-button" aria-label="Enregistrer" disabled={saving}>
          <CircleCheckIcon />
        </button>
      </div>
      <h2>{editing ? 'Modifier la depense' : 'Ajouter une depense'}</h2>
      <label className="field-inline">
        <span className="label-text">Titre</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="field-inline">
        <span className="label-text">Prix</span>
        <input inputMode="decimal" placeholder="0,00 €" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="field-inline">
        <span className="label-text">Acheteur</span>
        <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
          {flatmates.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field-inline">
        <span className="label-text">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <fieldset>
        <legend>Participants</legend>
        {flatmates.map((f) => (
          <label key={f.id}>
            <input type="checkbox" checked={participantIds.includes(f.id)} onChange={() => toggle(f.id)} />
            {f.name}
          </label>
        ))}
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
