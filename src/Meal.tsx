import { useEffect, useState, type FormEvent } from 'react'
import type { Backend, Day, Flatmate, Meal, Recipe } from './backend/Backend'
import type { Clock } from './clock'
import { CircleMinusIcon, CirclePlusIcon } from './icons'
import { plain } from './plain'
import { useLive } from './useLive'

const parisParts = (moment: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(moment)
      .map((p) => [p.type, p.value]),
  )

const addDays = (day: Day, days: number): Day =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

/** 6:00 in Paris on that day. Paris is UTC+1 in winter and UTC+2 in summer. */
const sixInParis = (day: Day) => [5, 4].map((h) => new Date(`${day}T0${h}:00:00Z`)).find((d) => parisParts(d).hour === '06')!

/** The 6:00 that ends a Meal set at that moment: the next 6:00 in Paris. */
function endOfMeal(setAt: Date) {
  const p = parisParts(setAt)
  const today = `${p.year}-${p.month}-${p.day}`
  return Number(p.hour) < 6 ? sixInParis(today) : sixInParis(addDays(today, 1))
}

/**
 * Tonight's Meal, null when there is none; undefined while loading.
 * Derived on read: one set before the latest 6:00 in Paris counts as empty, and it empties on screen when its 6:00 comes.
 */
export function useTonightsMeal(backend: Backend, clock: Clock): Meal | null | undefined {
  const meal = useLive(backend, 'meal', () => backend.getMeal())
  const [now, setNow] = useState(() => clock.now())

  const end = meal && endOfMeal(meal.setAt)
  useEffect(() => {
    if (!end || end <= now) return
    return clock.at(end, () => setNow(clock.now()))
  }, [end?.getTime(), clock, now])

  if (meal === undefined) return undefined
  return end && now < end ? meal : null
}

type Props = {
  backend: Backend
  clock: Clock
  me: Flatmate
  /** Tonight's Meal, from useTonightsMeal. */
  meal: Meal | null
  recipes: Recipe[]
  onOpenRecipe: (id: string) => void
}

/**
 * Tonight's Meal on the Recettes screen. Choosing is only offered while there is none:
 * to choose another, the Flatmate empties it first (spec #1 story 59, changed by the design).
 */
export function TonightsMeal({ backend, clock, me, meal, recipes, onOpenRecipe }: Props) {
  const [text, setText] = useState('')
  const recipe = meal?.recipeId ? recipes.find((r) => r.id === meal.recipeId) : undefined

  async function chooseText(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await backend.setMeal({ recipeId: null, text: plain(text.trim()), setBy: me.id, setAt: clock.now() })
    setText('')
  }

  return (
    <section aria-label="Selection du jour" className="card selection">
      {meal ? (
        <>
          <div className="selection-text">
            <p className="selection-label">Selection du jour :</p>
            {recipe ? (
              <button className="selection-dish" onClick={() => onOpenRecipe(recipe.id)}>
                {recipe.title}
              </button>
            ) : (
              // A Recipe not loaded yet shows no name until it arrives.
              <p className="selection-dish">{meal.text}</p>
            )}
          </div>
          <button className="card-icon" aria-label="Effacer" onClick={() => backend.clearMeal()}>
            <CircleMinusIcon />
          </button>
        </>
      ) : (
        <form className="selection-form" onSubmit={chooseText}>
          <div className="selection-text">
            <p className="selection-label selection-label-empty">Selection du jour :</p>
            <input aria-label="Autre plat" placeholder="Vide" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <button type="submit" className="card-icon" aria-label="Choisir">
            <CirclePlusIcon />
          </button>
        </form>
      )}
    </section>
  )
}
