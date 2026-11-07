import { useEffect, useState, type FormEvent } from 'react'
import type { Backend, Flatmate, Photo, Recipe } from './backend/Backend'
import type { Clock } from './clock'
import { ConfirmDialog } from './ConfirmDialog'
import { CircleCheckIcon, CirclePlusIcon, CircleXIcon, PencilIcon, TrashIcon } from './icons'
import { TonightsMeal, useTonightsMeal } from './Meal'
import { plain } from './plain'
import { useLive } from './useLive'

/** Nutrition values per portion, in the order and with the letters shown: "P: 43g G: 160g L: 20g". */
const NUTRIENTS = [
  { key: 'proteins', letter: 'P', label: 'Proteines (g)' },
  { key: 'carbs', letter: 'G', label: 'Glucides (g)' },
  { key: 'fats', letter: 'L', label: 'Lipides (g)' },
] as const

type Nutrient = (typeof NUTRIENTS)[number]['key']

/** Only the values given; empty when none is. */
export const formatNutrition = (recipe: Recipe) =>
  NUTRIENTS.filter((n) => recipe[n.key] !== null)
    .map((n) => `${n.letter}: ${recipe[n.key]}g`)
    .join(' ')

type Props = { backend: Backend; clock: Clock; me: Flatmate; flatmates: Flatmate[] | undefined }

export function Recipes({ backend, clock, me, flatmates }: Props) {
  const recipes = useLive(backend, 'recipes', () => backend.listRecipes())
  const meal = useTonightsMeal(backend, clock)
  // The form is closed, adding a new Recipe, or editing this one.
  const [form, setForm] = useState<'closed' | 'new' | Recipe>('closed')
  const [openId, setOpenId] = useState<string | null>(null)
  // Asking whether to delete the open Recipe; reset whenever a Recipe opens.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  if (!recipes || !flatmates || meal === undefined) return null

  const nameOf = (id: string) => flatmates.find((f) => f.id === id)!.name
  const openRecipeById = (id: string) => {
    setConfirmingDelete(false)
    setOpenId(id)
  }
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
            question={`Supprimer la recette "${openRecipe.title}" ?`}
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
      <h2>Recettes</h2>
      <TonightsMeal backend={backend} clock={clock} me={me} meal={meal} recipes={recipes} onOpenRecipe={openRecipeById} />
      <ul className="recipe-list" aria-label="Recettes">
        {[...recipes]
          .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
          .map((r) => (
            <li key={r.id} className="card recipe-card">
              <button className="recipe-open" aria-label={r.title} onClick={() => openRecipeById(r.id)}>
                {r.photo?.url ? <img className="recipe-photo" src={r.photo.url} alt={r.title} /> : <span className="recipe-photo" />}
                <span className="recipe-title">{r.title}</span>
                {formatNutrition(r) && <span className="recipe-nutrition">{formatNutrition(r)}</span>}
              </button>
              {!meal && (
                <button
                  className="card-icon"
                  aria-label={`Choisir ${r.title} pour ce soir`}
                  onClick={() => backend.setMeal({ recipeId: r.id, text: null, setBy: me.id, setAt: clock.now() })}
                >
                  <CirclePlusIcon />
                </button>
              )}
            </li>
          ))}
      </ul>
      <button className="action-button fab" aria-label="Ajouter une recette" onClick={() => setForm('new')}>
        <CirclePlusIcon />
      </button>
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
    <article className="recipe-view">
      <div className="screen-actions">
        <button className="action-button" aria-label="Modifier" onClick={onEdit}>
          <PencilIcon />
        </button>
        <button className="action-button" aria-label="Supprimer" onClick={onDelete}>
          <TrashIcon />
        </button>
        <button className="action-button" aria-label="Retour" onClick={onBack}>
          <CircleXIcon />
        </button>
      </div>
      <h2>{recipe.title}</h2>
      {recipe.photo?.url && <img className="recipe-view-photo" src={recipe.photo.url} alt={recipe.title} />}
      {formatNutrition(recipe) && <p className="recipe-view-nutrition">{formatNutrition(recipe)}</p>}
      {recipe.text && <p className="recipe-view-text">{recipe.text}</p>}
      <p className="recipe-view-creator">Ajoutee par {nameOf(recipe.creatorId)}</p>
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
  // The photo kept from before, until a new file replaces it or it is removed.
  const [photo, setPhoto] = useState<Photo | null>(editing?.photo ?? null)
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [grams, setGrams] = useState(
    () => Object.fromEntries(NUTRIENTS.map((n) => [n.key, editing?.[n.key]?.toString() ?? ''])) as Record<Nutrient, string>,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const preview = usePreview(newPhoto) ?? photo?.url

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Le titre est obligatoire.')
    // Whole grams, at most 9999: more is a typo, not a portion.
    if (NUTRIENTS.some((n) => grams[n.key].trim() && !/^\d{1,4}$/.test(grams[n.key].trim())))
      return setError('Les valeurs nutritionnelles sont des grammes entiers (ex. 43).')
    const gramsOf = (key: Nutrient) => (grams[key].trim() ? Number(grams[key].trim()) : null)
    setSaving(true)
    const changes = {
      title: plain(title.trim()),
      text: plain(text.trim()),
      // Recipes no longer show a link; an edit keeps whatever was saved before.
      link: editing?.link ?? null,
      photo: newPhoto ? await backend.uploadPhoto(newPhoto) : photo,
      proteins: gramsOf('proteins'),
      carbs: gramsOf('carbs'),
      fats: gramsOf('fats'),
    }
    if (editing) await backend.updateRecipe(editing.id, changes)
    else await backend.createRecipe({ ...changes, creatorId: me.id })
    onDone()
  }

  return (
    <form className="recipe-form" onSubmit={submit}>
      <div className="screen-actions">
        <button type="button" className="action-button" aria-label="Annuler" onClick={onDone}>
          <CircleXIcon />
        </button>
        <button type="submit" className="action-button" aria-label="Enregistrer" disabled={saving}>
          <CircleCheckIcon />
        </button>
      </div>
      <h2>{editing ? 'Modifier la recette' : 'Ajouter une recette'}</h2>
      <label className="field-inline">
        <span className="label-text">Titre</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        <span className="label-text">Recette</span>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {NUTRIENTS.map((n) => (
        <label key={n.key} className="field-inline">
          <span className="label-text">{n.label}</span>
          <input
            inputMode="numeric"
            value={grams[n.key]}
            onChange={(e) => setGrams((g) => ({ ...g, [n.key]: e.target.value }))}
          />
        </label>
      ))}
      <label className="field-inline photo-picker">
        <span className="label-text">Photo</span>
        <span className="action-button" aria-hidden="true">
          <CirclePlusIcon />
        </span>
        <input type="file" accept="image/*" onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)} />
      </label>
      <div className="photo-preview">
        {preview && <img src={preview} alt={newPhoto ? 'Nouvelle photo' : 'Photo actuelle'} />}
      </div>
      {photo && !newPhoto && (
        <button type="button" className="text-button" onClick={() => setPhoto(null)}>
          Retirer la photo
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

/** A local address to show a picked file before it is uploaded. */
function usePreview(file: File | null) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!file) return setUrl(undefined)
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return url
}
