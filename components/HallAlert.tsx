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

  const isBingo = alert.kind === 'bingo'
  const title = isBingo ? 'BINGO!' : 'FULL HOUSE!'
  const sub = isBingo ? 'One line claimed' : 'House claimed'
  const pieceCount = size === 'hall' ? (isBingo ? 120 : 96) : isBingo ? 72 : 64

  return (
    <div
      className={[
        'hall-alert',
        size === 'hall' ? 'hall-alert--hall' : '',
        isBingo ? 'hall-alert--bingo' : 'hall-alert--full-house',
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="assertive"
    >
      {!isBingo ? (
        <div className="hall-alert-rings" aria-hidden>
          <span className="hall-alert-ring hall-alert-ring--1" />
          <span className="hall-alert-ring hall-alert-ring--2" />
          <span className="hall-alert-ring hall-alert-ring--3" />
        </div>
      ) : null}
      <div className="hall-alert-confetti" aria-hidden>
        {Array.from({ length: pieceCount }, (_, i) => (
          <span
            key={`${confettiId}-${i}`}
            className={isBingo ? 'hall-alert-piece hall-alert-piece--fall' : 'hall-alert-piece hall-alert-piece--burst'}
            style={
              {
                '--x': `${(i * 17) % 100}%`,
                '--y': `${(i * 23) % 100}%`,
                '--delay': `${(i % 16) * 0.06}s`,
                '--dur': `${isBingo ? 2 + (i % 9) * 0.18 : 1.6 + (i % 7) * 0.2}s`,
                '--rot': `${(i * 47) % 360}deg`,
                '--hue': `${isBingo ? (i * 29) % 360 : 110 + (i * 11) % 70}`,
                '--size': `${0.55 + (i % 5) * 0.22}rem`,
                '--angle': `${(i * 37) % 360}deg`,
                '--dist': `${35 + (i % 8) * 8}%`,
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
