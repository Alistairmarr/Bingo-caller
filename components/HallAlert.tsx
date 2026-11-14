'use client'

import { useId, type CSSProperties } from 'react'
import type { HallAlert as HallAlertState } from './game/types'

/** Full-screen Bingo / Full House for Display + Mobile — stays until Caller dismisses. */
export function HallAlertBanner({
  alert,
  size = 'default',
}: {
  alert: HallAlertState | null
  size?: 'default' | 'hall'
}) {
  const confettiId = useId()

  if (!alert) return null

  const title = alert.kind === 'bingo' ? 'BINGO!' : 'FULL HOUSE!'
  const sub = alert.kind === 'bingo' ? 'One line claimed' : 'House claimed'
  const pieceCount = size === 'hall' ? 120 : 72

  return (
    <div
      className={[
        'hall-alert',
        size === 'hall' ? 'hall-alert--hall' : '',
        alert.kind === 'bingo' ? 'hall-alert--bingo' : 'hall-alert--full-house',
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="assertive"
    >
      <div className="hall-alert-confetti" aria-hidden>
        {Array.from({ length: pieceCount }, (_, i) => (
          <span
            key={`${confettiId}-${i}`}
            className="hall-alert-piece"
            style={
              {
                '--x': `${(i * 17) % 100}%`,
                '--delay': `${(i % 16) * 0.06}s`,
                '--dur': `${2 + (i % 9) * 0.18}s`,
                '--rot': `${(i * 47) % 360}deg`,
                '--hue': `${(i * 29) % 360}`,
                '--size': `${0.55 + (i % 5) * 0.22}rem`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <p className="hall-alert-kicker">Ancrum Fete</p>
      <p className="hall-alert-title">{title}</p>
      <p className="hall-alert-sub">{sub}</p>
    </div>
  )
}
