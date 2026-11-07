import { useId } from 'react'

type Props = { question: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }

/** Every delete (Expense, Recipe, Settlement) and recording a Settlement ask through this dialog first. */
export function ConfirmDialog({ question, confirmLabel, onConfirm, onCancel }: Props) {
  const questionId = useId()
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby={questionId}>
      <p id={questionId}>{question}</p>
      <button autoFocus onClick={onCancel}>
        Annuler
      </button>
      <button onClick={onConfirm}>{confirmLabel}</button>
    </div>
  )
}
