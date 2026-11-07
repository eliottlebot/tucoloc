import { useId } from 'react'

type Props = { question: string; onConfirm: () => void; onCancel: () => void }

/** Every delete (Expense, Recipe, Settlement) asks through this dialog first. */
export function ConfirmDelete({ question, onConfirm, onCancel }: Props) {
  const questionId = useId()
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby={questionId}>
      <p id={questionId}>{question}</p>
      <button autoFocus onClick={onCancel}>
        Annuler
      </button>
      <button onClick={onConfirm}>Supprimer</button>
    </div>
  )
}
