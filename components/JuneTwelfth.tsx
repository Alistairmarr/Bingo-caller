'use client'

import { useId, type CSSProperties } from 'react'

/**
 * Village-hall easter egg when 12 is called — next year’s Ancrum Fete is June 12th.
 * Stays until the next number (same pattern as Dirty Girty).
 */
export function JuneTwelfth({
  trigger,
  size = 'default',
}: {
  trigger: boolean
  /** `hall` = bigger type for TV Display only */
  size?: 'default' | 'hall'
}) {
  const confettiId = useId()

  if (!trigger) return null

  return (
    <div
      className={
        size === 'hall' ? 'june12-overlay june12-overlay--hall' : 'june12-overlay'
      }
      role="status"
      aria-live="assertive"
    >
      <div className="june12-confetti" aria-hidden>
        {Array.from({ length: size === 'hall' ? 64 : 40 }, (_, i) => (
          <span
            key={`${confettiId}-${i}`}
            className="june12-piece"
            style={
              {
                '--x': `${(i * 19) % 100}%`,
                '--delay': `${(i % 10) * 0.09}s`,
                '--dur': `${2.2 + (i % 6) * 0.2}s`,
                '--rot': `${(i * 41) % 360}deg`,
                '--hue': `${95 + (i * 17) % 55}`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <p className="june12-kicker">Ancrum Fete</p>
      <p className={size === 'hall' ? 'june12-line june12-line--hall' : 'june12-line'}>
        See you next year — June 12th
      </p>
      <p className="june12-sub">On the village green</p>
    </div>
  )
}
