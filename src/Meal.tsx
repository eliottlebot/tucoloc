import { useEffect, useState, type FormEvent } from 'react'
import type { Backend, Day, Flatmate, Meal, Recipe } from './backend/Backend'
import type { Clock } from './clock'
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

const formatTime = (date: Date) =>
  date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

type Props = {
  backend: Backend
  clock: Clock
  me: Flatmate
  recipes: Recipe[]
  nameOf: (id: string) => string
  onOpenRecipe: (id: string) => void
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

export function TonightsMeal({ backend, clock, me, recipes, nameOf, onOpenRecipe }: Props) {
  const current = useTonightsMeal(backend, clock)
  const [text, setText] = useState('')

  if (current === undefined) return null
  const recipe = current?.recipeId ? recipes.find((r) => r.id === current.recipeId) : undefined

  async function chooseText(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await backend.setMeal({ recipeId: null, text: plain(text.trim()), setBy: me.id, setAt: clock.now() })
    setText('')
  }

  return (
    <section aria-label="Ce soir">
      <h2>Ce soir</h2>
      {current && (recipe || current.text) ? (
        <>
          <p>
            {recipe ? <button onClick={() => onOpenRecipe(recipe.id)}>{recipe.title}</button> : current.text}
          </p>
          <p>
            Choisi par {nameOf(current.setBy)} a {formatTime(current.setAt)}
          </p>
          <button onClick={() => backend.clearMeal()}>Effacer</button>
        </>
      ) : (
        <p>Rien de prevu.</p>
      )}
      <form onSubmit={chooseText}>
        <label>
          Autre plat
          <input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <button type="submit">Choisir</button>
      </form>
    </section>
  )
}
