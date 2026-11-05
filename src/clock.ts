export type Clock = {
  now(): Date
  /** Calls callback once now reaches time. Returns a function that cancels it. */
  at(time: Date, callback: () => void): () => void
}

export const systemClock: Clock = {
  now: () => new Date(),
  at(time, callback) {
    const timer = setTimeout(callback, time.getTime() - Date.now())
    return () => clearTimeout(timer)
  },
}
