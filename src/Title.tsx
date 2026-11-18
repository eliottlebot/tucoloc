import type { ReactNode } from 'react'

type Props = { children: ReactNode; left?: ReactNode; right?: ReactNode }

/** A screen or section title, centered, with optional content on each side (an add button goes on the right). */
export function Title({ children, left, right }: Props) {
  return (
    <div className="mt-8 mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="justify-self-start">{left}</div>
      <h2 className="m-0">{children}</h2>
      <div className="justify-self-end">{right}</div>
    </div>
  )
}
