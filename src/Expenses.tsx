import { useState, type FormEvent } from 'react'
import type { Backend, Day, Expense, Flatmate } from './backend/Backend'
import type { Clock } from './clock'
import { ConfirmDelete } from './ConfirmDelete'
import { useLive } from './useLive'

const formatEuros = (cents: number) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/** Cents as form input text: "12,50", without the € sign. */
const toAmountInput = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

const formatDay = (day: Day) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Today's date in Paris, as a Day. */
const today = (clock: Clock): Day => clock.now().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

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

/** Newest date first; same date, last entered first. */
const newestFirst = (a: Expense, b: Expense) =>
  b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime()

type Props = { backend: Backend; clock: Clock; me: Flatmate; flatmates: Flatmate[] | undefined }

export function Expenses({ backend, clock, me, flatmates }: Props) {
  const expenses = useLive(backend, 'expenses', () => backend.listExpenses())
  // The form is closed, adding a new Expense, or editing this one.
  const [form, setForm] = useState<'closed' | 'new' | Expense>('closed')
  const [deleting, setDeleting] = useState<Expense | null>(null)
  if (!expenses || !flatmates) return null

  const nameOf = (id: string) => flatmates.find((f) => f.id === id)!.name

  return (
    <>
      {form === 'closed' ? (
        <button onClick={() => setForm('new')}>Ajouter une dépense</button>
      ) : (
        <ExpenseForm
          key={form === 'new' ? 'new' : form.id}
          backend={backend}
          clock={clock}
          me={me}
          flatmates={flatmates}
          editing={form === 'new' ? undefined : form}
          onDone={() => setForm('closed')}
        />
      )}
      <ul>
        {[...expenses].sort(newestFirst).map((e) => (
          <ExpenseItem
            key={e.id}
            expense={e}
            flatmates={flatmates}
            nameOf={nameOf}
            onEdit={() => setForm(e)}
            onDelete={() => setDeleting(e)}
          />
        ))}
      </ul>
      {deleting && (
        <ConfirmDelete
          question={`Supprimer la dépense « ${deleting.label} » ?`}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            setDeleting(null)
            await backend.deleteExpense(deleting.id)
          }}
        />
      )}
    </>
  )
}

type ItemProps = {
  expense: Expense
  flatmates: Flatmate[]
  nameOf: (id: string) => string
  onEdit: () => void
  onDelete: () => void
}

function ExpenseItem({ expense, flatmates, nameOf, onEdit, onDelete }: ItemProps) {
  const split = splitEqually(expense.amountCents, expense.participantIds)
  // Shown in the usual Flatmate order, whatever order the leftover cents followed.
  const shares = flatmates.flatMap((f) => split.filter((s) => s.flatmateId === f.id))
  return (
    <li aria-label={expense.label}>
      <strong>{expense.label}</strong> <span>{formatEuros(expense.amountCents)}</span>
      <p>
        <span>{formatDay(expense.date)}</span> · <span>Payé par {nameOf(expense.payerId)}</span> ·{' '}
        <span>Ajoutée par {nameOf(expense.creatorId)}</span>
      </p>
      <p>{shares.map((s) => `${nameOf(s.flatmateId)} ${formatEuros(s.cents)}`).join(' · ')}</p>
      <button onClick={onEdit}>Modifier</button>
      <button onClick={onDelete}>Supprimer</button>
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
  const [date, setDate] = useState(() => editing?.date ?? today(clock))
  const [payerId, setPayerId] = useState(editing?.payerId ?? me.id)
  const [participantIds, setParticipantIds] = useState(editing?.participantIds ?? flatmates.map((f) => f.id))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) =>
    setParticipantIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amountCents = parseEuros(amount)
    if (!label.trim()) return setError('Le libellé est obligatoire.')
    if (!amountCents) return setError('Indique un montant supérieur à 0 (ex. 12,50).')
    if (!date) return setError('La date est obligatoire.')
    if (participantIds.length === 0) return setError('Choisis au moins un participant.')
    setSaving(true)
    const changes = { label: label.trim(), amountCents, date, payerId, participantIds }
    if (editing) await backend.updateExpense(editing.id, changes)
    else await backend.createExpense({ ...changes, creatorId: me.id, createdAt: clock.now() })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <label>
        Libellé
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label>
        Montant (€)
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        Payé par
        <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
          {flatmates.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
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
      <button type="submit" disabled={saving}>
        Enregistrer
      </button>
      <button type="button" onClick={onDone}>
        Annuler
      </button>
    </form>
  )
}
