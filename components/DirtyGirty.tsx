'use client'

import { useId, type CSSProperties } from 'react'

/** Village-hall easter egg when 30 is called — stays until the next number. */
export function DirtyGirty({
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
      className={size === 'hall' ? 'girty-overlay girty-overlay--hall' : 'girty-overlay'}
      role="status"
      aria-live="assertive"
    >
      <div className="girty-confetti" aria-hidden>
        {Array.from({ length: size === 'hall' ? 72 : 48 }, (_, i) => (
          <span
            key={`${confettiId}-${i}`}
            className="girty-piece"
            style={
              {
                '--x': `${(i * 17) % 100}%`,
                '--delay': `${(i % 12) * 0.08}s`,
                '--dur': `${2.4 + (i % 7) * 0.18}s`,
                '--rot': `${(i * 47) % 360}deg`,
                '--hue': `${(i * 29) % 360}`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <p className={size === 'hall' ? 'girty-line girty-line--hall' : 'girty-line'}>
        DIRTY GIRTY FROM NUMBER THIRTY
      </p>
    </div>
  )
}
