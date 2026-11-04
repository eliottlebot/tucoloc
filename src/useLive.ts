import { useEffect, useState } from 'react'
import type { Backend, Topic } from './backend/Backend'

/** Loads data, then reloads it whenever the Backend reports a change on its topic. */
export function useLive<T>(backend: Backend, topic: Topic, load: () => Promise<T>): T | undefined {
  const [data, setData] = useState<T>()

  useEffect(() => {
    let active = true
    const reload = () => load().then((d) => active && setData(d))
    reload()
    const unsubscribe = backend.subscribe((t) => t === topic && reload())
    return () => {
      active = false
      unsubscribe()
    }
    // load is re-created each render; backend + topic identify the data
  }, [backend, topic])

  return data
}
