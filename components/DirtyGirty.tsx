'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'

const LINES = [
  'Dirty Girty from Number 30!',
  "She's back — Dirty Girty from Number 30!",
  'Village legend: Dirty Girty from Number 30!',
  'Oh behave… Dirty Girty from Number 30!',
]

/** Village-hall easter egg when 30 is called — centre popup for 5 seconds. */
export function DirtyGirty({ trigger }: { trigger: boolean }) {
  const [visible, setVisible] = useState(false)
  const [line, setLine] = useState(LINES[0]!)
  const latch = useRef(false)
  const confettiId = useId()

  useEffect(() => {
    if (!trigger) {
      latch.current = false
      setVisible(false)
      return
    }
    if (latch.current) return
    latch.current = true
    setLine(LINES[Math.floor(Math.random() * LINES.length)]!)
    setVisible(true)
    const hide = window.setTimeout(() => setVisible(false), 5000)
    return () => window.clearTimeout(hide)
  }, [trigger])

  if (!visible) return null

  return (
    <div className="girty-overlay" role="status" aria-live="assertive">
      <div className="girty-confetti" aria-hidden>
        {Array.from({ length: 48 }, (_, i) => (
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
      <div className="girty-card">
        <p className="girty-kicker">Thirty! · Hall favourite</p>
        <p className="girty-line">{line}</p>
        <p className="girty-sub">Give us a wink, Girty</p>
      </div>
    </div>
  )
}
