import { useState, type FormEvent } from 'react'
import type { Backend, Flatmate, Recipe } from './backend/Backend'
import { ConfirmDialog } from './ConfirmDialog'
import { useLive } from './useLive'

type Props = { backend: Backend; me: Flatmate; flatmates: Flatmate[] | undefined }

export function Recipes({ backend, me, flatmates }: Props) {
  const recipes = useLive(backend, 'recipes', () => backend.listRecipes())
  // The form is closed, adding a new Recipe, or editing this one.
  const [form, setForm] = useState<'closed' | 'new' | Recipe>('closed')
  const [openId, setOpenId] = useState<string | null>(null)
  // Asking whether to delete the open Recipe; reset whenever a Recipe opens.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  if (!recipes || !flatmates) return null

  const nameOf = (id: string) => flatmates.find((f) => f.id === id)!.name
  // Looked up live, so a Recipe deleted on another phone closes here too.
  const openRecipe = recipes.find((r) => r.id === openId)

  if (form !== 'closed')
    return (
      <RecipeForm
        backend={backend}
        me={me}
        editing={form === 'new' ? undefined : form}
        onDone={() => setForm('closed')}
      />
    )
  if (openRecipe)
    return (
      <>
        <RecipeView
          recipe={openRecipe}
          nameOf={nameOf}
          onBack={() => setOpenId(null)}
          onEdit={() => setForm(openRecipe)}
          onDelete={() => setConfirmingDelete(true)}
        />
        {confirmingDelete && (
          <ConfirmDialog
            question={`Supprimer la recette « ${openRecipe.title} » ?`}
            confirmLabel="Supprimer"
            onCancel={() => setConfirmingDelete(false)}
            onConfirm={async () => {
              setOpenId(null)
              await backend.deleteRecipe(openRecipe.id)
            }}
          />
        )}
      </>
    )

  return (
    <>
      <button onClick={() => setForm('new')}>Ajouter une recette</button>
      <ul aria-label="Recettes">
        {[...recipes]
          .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
          .map((r) => (
            <li key={r.id}>
              <button
                onClick={() => {
                  setConfirmingDelete(false)
                  setOpenId(r.id)
                }}
              >
                {r.title}
              </button>
            </li>
          ))}
      </ul>
    </>
  )
}

type ViewProps = {
  recipe: Recipe
  nameOf: (id: string) => string
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

function RecipeView({ recipe, nameOf, onBack, onEdit, onDelete }: ViewProps) {
  return (
    <article>
      <h2>{recipe.title}</h2>
      {recipe.text && <p style={{ whiteSpace: 'pre-wrap' }}>{recipe.text}</p>}
      {recipe.link && (
        <p>
          <a href={recipe.link} target="_blank" rel="noopener noreferrer">
            {recipe.link}
          </a>
        </p>
      )}
      <p>Ajoutée par {nameOf(recipe.creatorId)}</p>
      <button onClick={onBack}>Retour</button>
      <button onClick={onEdit}>Modifier</button>
      <button onClick={onDelete}>Supprimer</button>
    </article>
  )
}

type FormProps = {
  backend: Backend
  me: Flatmate
  /** The Recipe being edited; a new Recipe when absent. */
  editing?: Recipe
  onDone: () => void
}

function RecipeForm({ backend, me, editing, onDone }: FormProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [text, setText] = useState(editing?.text ?? '')
  const [link, setLink] = useState(editing?.link ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Le titre est obligatoire.')
    // Only web addresses: a javascript: link would run code when tapped.
    if (link.trim() && !/^https?:\/\//.test(link.trim()))
      return setError('Le lien doit commencer par http:// ou https://.')
    setSaving(true)
    const changes = { title: title.trim(), text: text.trim(), link: link.trim() || null }
    if (editing) await backend.updateRecipe(editing.id, changes)
    else await backend.createRecipe({ ...changes, creatorId: me.id })
    onDone()
  }

  return (
    <form onSubmit={submit}>
      <label>
        Titre
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Recette
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label>
        Lien
        <input inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} />
      </label>
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
