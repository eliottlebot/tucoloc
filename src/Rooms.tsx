import { useEffect, useState } from 'react'
import type { Backend, Flatmate, Occupancy, RoomId } from './backend/Backend'
import type { Clock } from './clock'
import { useLive } from './useLive'

const MINUTE = 60 * 1000

/** freesAfter: a forgotten Occupancy counts as over after this long (spec #1, auto-free). */
type Room = { id: RoomId; name: string; occupied: string; freesAfter: number }

const ROOMS: Room[] = [
  { id: 'wc', name: 'WC', occupied: 'Occupe', freesAfter: 15 * MINUTE },
  { id: 'salle-de-bain', name: 'Salle de bain', occupied: 'Occupee', freesAfter: 45 * MINUTE },
]

const endOf = (o: Occupancy) => o.since.getTime() + ROOMS.find((r) => r.id === o.room)!.freesAfter

/** Occupancies that haven't freed themselves yet. Derived on read: nothing runs in the background. */
const ongoing = (occupancies: Occupancy[], now: Date) => occupancies.filter((o) => now.getTime() < endOf(o))

const formatTime = (date: Date) =>
  date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

type Props = { backend: Backend; clock: Clock; me: Flatmate; flatmates: Flatmate[] | undefined }

export function Rooms({ backend, clock, me, flatmates }: Props) {
  const occupancies = useLive(backend, 'occupancies', () => backend.listOccupancies())
  const [refusal, setRefusal] = useState<{ room: RoomId; message: string } | null>(null)
  const [now, setNow] = useState(() => clock.now())

  // Move to the time the next Occupancy frees itself, so the screen never shows an expired one.
  useEffect(() => {
    if (!occupancies) return
    const ends = occupancies.map(endOf).filter((end) => end > now.getTime())
    if (ends.length === 0) return
    return clock.at(new Date(Math.min(...ends)), () => setNow(clock.now()))
  }, [occupancies, clock, now])

  if (!occupancies || !flatmates) return null
  const current = ongoing(occupancies, now)

  const nameOf = (id: string) => flatmates.find((f) => f.id === id)!.name

  // The screen may lag behind another phone, so check the latest state before writing.
  async function occupy(room: Room) {
    const taken = ongoing(await backend.listOccupancies(), clock.now()).find((o) => o.room === room.id)
    if (taken) {
      setRefusal({ room: room.id, message: `${room.name} deja ${room.occupied.toLowerCase()} par ${nameOf(taken.flatmateId)}.` })
      return
    }
    setRefusal(null)
    await backend.occupy(room.id, me.id, clock.now())
  }

  return (
    <>
      {ROOMS.map((room) => {
        const occupancy = current.find((o) => o.room === room.id)
        return (
          <section key={room.id} aria-label={room.name}>
            <h2>{room.name}</h2>
            {occupancy ? (
              <>
                <p>
                  {room.occupied} par {nameOf(occupancy.flatmateId)} depuis {formatTime(occupancy.since)}
                </p>
                <button onClick={() => backend.free(room.id)}>Je libere</button>
              </>
            ) : (
              <>
                <p>Libre</p>
                <button onClick={() => occupy(room)}>J'occupe</button>
              </>
            )}
            {refusal?.room === room.id && <p role="alert">{refusal.message}</p>}
          </section>
        )
      })}
    </>
  )
}
