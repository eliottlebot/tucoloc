import type { Backend, Flatmate } from './backend/Backend'
import type { Clock } from './clock'
import { useTonightsMeal } from './Meal'
import { formatNutrition } from './Recipes'
import { Rooms } from './Rooms'
import { useLive } from './useLive'

type Props = { backend: Backend; clock: Clock; me: Flatmate; flatmates: Flatmate[] | undefined }

/** The screen the app opens on: tonight's Meal and the Rooms. */
export function HomeScreen({ backend, clock, me, flatmates }: Props) {
  return (
    <>
      <TonightsMealCard backend={backend} clock={clock} flatmates={flatmates} />
      <Rooms backend={backend} clock={clock} me={me} flatmates={flatmates} />
    </>
  )
}

type MealProps = { backend: Backend; clock: Clock; flatmates: Flatmate[] | undefined }

function TonightsMealCard({ backend, clock, flatmates }: MealProps) {
  const meal = useTonightsMeal(backend, clock)
  const recipes = useLive(backend, 'recipes', () => backend.listRecipes())
  if (meal === undefined || !recipes || !flatmates) return null

  const recipe = meal?.recipeId ? recipes.find((r) => r.id === meal.recipeId) : undefined
  const title = recipe?.title ?? meal?.text
  const chosenBy = meal && flatmates.find((f) => f.id === meal.setBy)?.name

  return (
    <section aria-label="Recette du jour">
      <h2>Recette du jour</h2>
      <div className="card meal-card">
        {meal && title ? (
          <>
            {recipe?.photo?.url ? (
              <img className="meal-photo" src={recipe.photo.url} alt={recipe.title} />
            ) : (
              recipe && <div className="meal-photo" />
            )}
            <div className="meal-details">
              <p className="meal-title">{title}</p>
              <p className="meal-chosen-by">Choisie par {chosenBy}</p>
              {recipe && formatNutrition(recipe) && <p className="meal-nutrition">{formatNutrition(recipe)}</p>}
            </div>
          </>
        ) : (
          <p className="meal-empty">Aucun plat choisi</p>
        )}
      </div>
    </section>
  )
}
