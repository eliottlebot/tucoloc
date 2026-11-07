import { ConnectionError, type Backend } from './Backend'

/** A call that can't reach the server reports it and never settles, so a failed write never looks saved. */
export function watchConnection(backend: Backend, onChange: (connected: boolean) => void): Backend {
  return new Proxy(backend, {
    get(target, key) {
      const member = Reflect.get(target, key)
      if (typeof member !== 'function') return member
      return (...args: unknown[]) => {
        const result = member.apply(target, args)
        if (!(result instanceof Promise)) return result
        return result.then(
          (value) => {
            onChange(true)
            return value
          },
          (err) => {
            if (!(err instanceof ConnectionError)) throw err
            onChange(false)
            return new Promise(() => {})
          },
        )
      }
    },
  })
}
