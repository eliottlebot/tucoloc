import type { Backend, Flatmate } from './backend/Backend'
import type { Clock } from './clock'
import { useTonightsMeal } from './Meal'
import { formatNutrition } from './Recipes'
import { Rooms } from './Rooms'
import { card, display, photoThumb } from './ui'
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
      <div className={`${card} flex min-h-34 items-stretch gap-3.25`}>
        {meal && title ? (
          <>
            {recipe?.photo?.url ? (
              <img className={`${photoThumb} flex-none`} src={recipe.photo.url} alt={recipe.title} />
            ) : (
              recipe && <div className={`${photoThumb} flex-none`} />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <p className={`${display} m-0 text-24 wrap-anywhere text-highlight`}>{title}</p>
              <p className="m-0 text-18 text-background">Choisie par {chosenBy}</p>
              {recipe && formatNutrition(recipe) && <p className="m-0 mt-auto text-16 text-background">{formatNutrition(recipe)}</p>}
            </div>
          </>
        ) : (
          <p className="m-0 flex-1 self-center text-center text-20 text-background">Aucun plat choisi</p>
        )}
      </div>
    </section>
  )
}
