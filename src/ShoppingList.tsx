import { useState, type FormEvent } from "react";
import type { Backend, ShoppingItem } from "./backend/Backend";
import type { Clock } from "./clock";
import { ConfirmDialog } from "./ConfirmDialog";
import { CircleCheckIcon, CirclePlusIcon, CircleXIcon } from "./icons";
import { plain } from "./plain";
import { actionButton, cardIcon, cardList } from "./ui";
import { useLive } from "./useLive";
import { Title } from "./Title";

/** Items to buy first, oldest on top; then bought Items, in the order they were bought. Ties by id, the same on every phone. */
const shoppingOrder = (a: ShoppingItem, b: ShoppingItem) => {
  if (!a.boughtAt !== !b.boughtAt) return a.boughtAt ? 1 : -1;
  return (
    (a.boughtAt ?? a.addedAt).getTime() - (b.boughtAt ?? b.addedAt).getTime() ||
    a.id.localeCompare(b.id)
  );
};

type Props = { backend: Backend; clock: Clock };

/** The shared Shopping List. Deleting an Item asks nothing: it is one line of a list, not worth a confirmation. */
export function ShoppingList({ backend, clock }: Props) {
  const items = useLive(backend, "shopping", () => backend.listShoppingItems());
  const [name, setName] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  if (!items) return null;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await backend.addShoppingItem({
      name: plain(name.trim()),
      addedAt: clock.now(),
    });
    setName("");
  }

  return (
    <>
      <Title>Liste de courses</Title>
      <button
        className="inline-grid h-11 w-full place-items-center rounded-button bg-action p-0 text-on-card"
        aria-label="Vider les articles achetes"
        disabled={!items.some((i) => i.boughtAt)}
        onClick={() => setConfirmingClear(true)}
      >
        <CircleCheckIcon />
      </button>
      <form className="mt-3 flex items-center gap-3" onSubmit={add}>
        <input
          className="mt-0 text-24 placeholder:text-placeholder"
          aria-label="Nouvel article"
          placeholder="Ex : carottes"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className={actionButton} aria-label="Ajouter">
          <CirclePlusIcon />
        </button>
      </form>
      <ul className={cardList} aria-label="Liste de courses">
        {[...items].sort(shoppingOrder).map((item, i, sorted) => [
          // A blue line between the Items to buy and the bought ones, when there are both.
          item.boughtAt && i > 0 && !sorted[i - 1].boughtAt && (
            <li
              key="separator"
              role="separator"
              className="mx-0 mt-1 mb-4 h-0.75 rounded-xs bg-card"
            />
          ),
          <li
            key={item.id}
            aria-label={item.name}
            className="mb-3 flex items-center gap-2.5 rounded-button bg-card shadow-md px-2.5 py-3 text-on-card"
          >
            <button
              className={cardIcon}
              aria-label="Supprimer"
              onClick={() => backend.deleteShoppingItem(item.id)}
            >
              <CircleXIcon />
            </button>
            {/* Tapping the name marks the Item bought, or puts a bought one back to buy. */}
            <button
              // One line; a long name ends with an ellipsis.
              className={`min-w-0 flex-1 truncate bg-transparent p-0 text-left text-24 text-on-card ${item.boughtAt ? "line-through" : ""}`}
              aria-label={
                item.boughtAt
                  ? `Remettre ${item.name} a acheter`
                  : `Marquer ${item.name} achete`
              }
              onClick={() =>
                backend.setShoppingItemBought(
                  item.id,
                  item.boughtAt ? null : clock.now(),
                )
              }
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
            setConfirmingClear(false);
            await backend.clearBoughtShoppingItems();
          }}
        />
      )}
    </>
  );
}
