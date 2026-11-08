import { useState, type FormEvent } from 'react'
import type { Backend, ShoppingItem } from './backend/Backend'
import type { Clock } from './clock'
import { ConfirmDialog } from './ConfirmDialog'
import { CircleCheckIcon, CirclePlusIcon, CircleXIcon } from './icons'
import { plain } from './plain'
import { useLive } from './useLive'

/** Items to buy first, oldest on top; then bought Items, in the order they were bought. Ties by id, the same on every phone. */
const shoppingOrder = (a: ShoppingItem, b: ShoppingItem) => {
  if (!a.boughtAt !== !b.boughtAt) return a.boughtAt ? 1 : -1
  return (a.boughtAt ?? a.addedAt).getTime() - (b.boughtAt ?? b.addedAt).getTime() || a.id.localeCompare(b.id)
}

type Props = { backend: Backend; clock: Clock }

/** The shared Shopping List. Deleting an Item asks nothing: it is one line of a list, not worth a confirmation. */
export function ShoppingList({ backend, clock }: Props) {
  const items = useLive(backend, 'shopping', () => backend.listShoppingItems())
  const [name, setName] = useState('')
  const [confirmingClear, setConfirmingClear] = useState(false)
  if (!items) return null

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await backend.addShoppingItem({ name: plain(name.trim()), addedAt: clock.now() })
    setName('')
  }

  return (
    <>
      <h2>Liste de courses</h2>
      <button
        className="action-button shopping-clear"
        aria-label="Vider les articles achetes"
        disabled={!items.some((i) => i.boughtAt)}
        onClick={() => setConfirmingClear(true)}
      >
        <CircleCheckIcon />
      </button>
      <form className="shopping-add" onSubmit={add}>
        <input aria-label="Nouvel article" placeholder="Ex : carottes" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="action-button" aria-label="Ajouter">
          <CirclePlusIcon />
        </button>
      </form>
      <ul className="card-list" aria-label="Liste de courses">
        {[...items].sort(shoppingOrder).map((item, i, sorted) => [
          // A blue line between the Items to buy and the bought ones, when there are both.
          item.boughtAt && i > 0 && !sorted[i - 1].boughtAt && <li key="separator" role="separator" className="shopping-separator" />,
          <li key={item.id} aria-label={item.name} className={item.boughtAt ? 'shopping-item bought' : 'shopping-item'}>
            <button className="card-icon" aria-label="Supprimer" onClick={() => backend.deleteShoppingItem(item.id)}>
              <CircleXIcon />
            </button>
            {/* Tapping the name marks the Item bought, or puts a bought one back to buy. */}
            <button
              className="shopping-name"
              aria-label={item.boughtAt ? `Remettre ${item.name} a acheter` : `Marquer ${item.name} achete`}
              onClick={() => backend.setShoppingItemBought(item.id, item.boughtAt ? null : clock.now())}
            >
              {item.name}
            </button>
          </li>,
        ])}
      </ul>
      {confirmingClear && (
        <ConfirmDialog
          question="Tout est achete ? Les articles valides seront retires de la liste."
          confirmLabel="Vider"
          onCancel={() => setConfirmingClear(false)}
          onConfirm={async () => {
            setConfirmingClear(false)
            await backend.clearBoughtShoppingItems()
          }}
        />
      )}
    </>
  )
}
