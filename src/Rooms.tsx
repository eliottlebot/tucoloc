import { useState } from 'react'
import type { Backend, Flatmate, RoomId } from './backend/Backend'
import type { Clock } from './clock'
import { useLive } from './useLive'

type Room = { id: RoomId; name: string; occupied: string }

const ROOMS: Room[] = [
  { id: 'wc', name: 'WC', occupied: 'Occupé' },
  { id: 'salle-de-bain', name: 'Salle de bain', occupied: 'Occupée' },
]

const formatTime = (date: Date) =>
  date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

type Props = { backend: Backend; clock: Clock; me: Flatmate; flatmates: Flatmate[] | undefined }

export function Rooms({ backend, clock, me, flatmates }: Props) {
  const occupancies = useLive(backend, 'occupancies', () => backend.listOccupancies())
  const [refusal, setRefusal] = useState<{ room: RoomId; message: string } | null>(null)
  if (!occupancies || !flatmates) return null

  const nameOf = (id: string) => flatmates.find((f) => f.id === id)!.name

  // The screen may lag behind another phone, so check the latest state before writing.
  async function occupy(room: Room) {
    const taken = (await backend.listOccupancies()).find((o) => o.room === room.id)
    if (taken) {
      setRefusal({ room: room.id, message: `${room.name} déjà ${room.occupied.toLowerCase()} par ${nameOf(taken.flatmateId)}.` })
      return
    }
    setRefusal(null)
    await backend.occupy(room.id, me.id, clock.now())
  }

  return (
    <>
      {ROOMS.map((room) => {
        const occupancy = occupancies.find((o) => o.room === room.id)
        return (
          <section key={room.id} aria-label={room.name}>
            <h2>{room.name}</h2>
            {occupancy ? (
              <>
                <p>
                  {room.occupied} par {nameOf(occupancy.flatmateId)} depuis {formatTime(occupancy.since)}
                </p>
                <button onClick={() => backend.free(room.id)}>Je libère</button>
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
