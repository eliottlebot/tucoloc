import { useState, type FormEvent } from 'react'
import type { Backend, Flatmate, Photo, Recipe } from './backend/Backend'
import type { Clock } from './clock'
import { ConfirmDialog } from './ConfirmDialog'
import { TonightsMeal } from './Meal'
import { useLive } from './useLive'

/** Nutrition values per portion, in the order and with the letters shown: "P: 43g G: 160g L: 20g". */
const NUTRIENTS = [
  { key: 'proteins', letter: 'P', label: 'Proteines (g)' },
  { key: 'carbs', letter: 'G', label: 'Glucides (g)' },
  { key: 'fats', letter: 'L', label: 'Lipides (g)' },
] as const

type Nutrient = (typeof NUTRIENTS)[number]['key']

/** Only the values given; empty when none is. */
const formatNutrition = (recipe: Recipe) =>
  NUTRIENTS.filter((n) => recipe[n.key] !== null)
    .map((n) => `${n.letter}: ${recipe[n.key]}g`)
    .join(' ')

type Props = { backend: Backend; clock: Clock; me: Flatmate; flatmates: Flatmate[] | undefined }

export function Recipes({ backend, clock, me, flatmates }: Props) {
  const recipes = useLive(backend, 'recipes', () => backend.listRecipes())
  // The form is closed, adding a new Recipe, or editing this one.
  const [form, setForm] = useState<'closed' | 'new' | Recipe>('closed')
  const [openId, setOpenId] = useState<string | null>(null)
  // Asking whether to delete the open Recipe; reset whenever a Recipe opens.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  if (!recipes || !flatmates) return null

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
          onChooseForTonight={async () => {
            setOpenId(null)
            await backend.setMeal({ recipeId: openRecipe.id, text: null, setBy: me.id, setAt: clock.now() })
          }}
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
      <TonightsMeal backend={backend} clock={clock} me={me} recipes={recipes} nameOf={nameOf} onOpenRecipe={openRecipeById} />
      <button onClick={() => setForm('new')}>Ajouter une recette</button>
      <ul aria-label="Recettes">
        {[...recipes]
          .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
          .map((r) => (
            <li key={r.id}>
              {r.photo?.url && <img src={r.photo.url} alt={r.title} width={48} height={48} style={{ objectFit: 'cover' }} />}
              <button onClick={() => openRecipeById(r.id)}>{r.title}</button>
              {formatNutrition(r) && <span>{formatNutrition(r)}</span>}
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
  onChooseForTonight: () => void
}

function RecipeView({ recipe, nameOf, onBack, onEdit, onDelete, onChooseForTonight }: ViewProps) {
  return (
    <article>
      <h2>{recipe.title}</h2>
      {recipe.photo?.url && <img src={recipe.photo.url} alt={recipe.title} style={{ maxWidth: '100%' }} />}
      {formatNutrition(recipe) && <p>{formatNutrition(recipe)}</p>}
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
      <button onClick={onChooseForTonight}>Choisir pour ce soir</button>
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
  // The photo kept from before, until a new file replaces it or it is removed.
  const [photo, setPhoto] = useState<Photo | null>(editing?.photo ?? null)
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
  const [grams, setGrams] = useState(
    () => Object.fromEntries(NUTRIENTS.map((n) => [n.key, editing?.[n.key]?.toString() ?? ''])) as Record<Nutrient, string>,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Le titre est obligatoire.')
    // Only web addresses: a javascript: link would run code when tapped.
    if (link.trim() && !/^https?:\/\//.test(link.trim()))
      return setError('Le lien doit commencer par http:// ou https://.')
    // Whole grams, at most 9999: more is a typo, not a portion.
    if (NUTRIENTS.some((n) => grams[n.key].trim() && !/^\d{1,4}$/.test(grams[n.key].trim())))
      return setError('Les valeurs nutritionnelles sont des grammes entiers (ex. 43).')
    const gramsOf = (key: Nutrient) => (grams[key].trim() ? Number(grams[key].trim()) : null)
    setSaving(true)
    const changes = {
      title: title.trim(),
      text: text.trim(),
      link: link.trim() || null,
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
      {NUTRIENTS.map((n) => (
        <label key={n.key}>
          {n.label}
          <input
            inputMode="numeric"
            value={grams[n.key]}
            onChange={(e) => setGrams((g) => ({ ...g, [n.key]: e.target.value }))}
          />
        </label>
      ))}
      {photo && !newPhoto && (
        <p>
          <img src={photo.url} alt="Photo actuelle" width={96} />
          <button type="button" onClick={() => setPhoto(null)}>
            Retirer la photo
          </button>
        </p>
      )}
      <label>
        Photo
        <input type="file" accept="image/*" onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)} />
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
