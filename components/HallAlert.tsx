'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { HallAlert as HallAlertState } from './game/types'

/** Full-screen Bingo / Full House flash for Display + Mobile. */
export function HallAlertBanner({
  alert,
  size = 'default',
}: {
  alert: HallAlertState | null
  size?: 'default' | 'hall'
}) {
  const [visible, setVisible] = useState<HallAlertState | null>(null)
  const seenId = useRef<number | null>(null)
  const confettiId = useId()

  useEffect(() => {
    if (!alert) return
    if (seenId.current === alert.id) return
    seenId.current = alert.id
    setVisible(alert)
    const hide = window.setTimeout(() => setVisible(null), 6000)
    return () => window.clearTimeout(hide)
  }, [alert])

  if (!visible) return null

  const title = visible.kind === 'bingo' ? 'BINGO!' : 'FULL HOUSE!'
  const sub = visible.kind === 'bingo' ? 'Line claimed' : 'House claimed'

  return (
    <div
      className={[
        'hall-alert',
        size === 'hall' ? 'hall-alert--hall' : '',
        visible.kind === 'bingo' ? 'hall-alert--bingo' : 'hall-alert--full-house',
      ]
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="assertive"
    >
      <div className="hall-alert-confetti" aria-hidden>
        {Array.from({ length: size === 'hall' ? 80 : 52 }, (_, i) => (
          <span
            key={`${confettiId}-${i}`}
            className="hall-alert-piece"
            style={
              {
                '--x': `${(i * 19) % 100}%`,
                '--delay': `${(i % 14) * 0.07}s`,
                '--dur': `${2.2 + (i % 8) * 0.16}s`,
                '--rot': `${(i * 53) % 360}deg`,
                '--hue': `${(i * 31) % 360}`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <p className="hall-alert-title">{title}</p>
      <p className="hall-alert-sub">{sub}</p>
    </div>
  )
}
