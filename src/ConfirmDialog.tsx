import { useId } from 'react'

type Props = { question: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }

/** Every delete (Expense, Recipe, Settlement) and recording a Settlement ask through this dialog first. */
export function ConfirmDialog({ question, confirmLabel, onConfirm, onCancel }: Props) {
  const questionId = useId()
  return (
    <div className="fixed inset-0 z-3 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-97 rounded-card bg-card p-5 text-center text-20 text-on-card" role="alertdialog" aria-modal="true" aria-labelledby={questionId}>
        <p id={questionId}>{question}</p>
        <button autoFocus onClick={onCancel}>
          Annuler
        </button>
        <button className="ml-3" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  )
}
