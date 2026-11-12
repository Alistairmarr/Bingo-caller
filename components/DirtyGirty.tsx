'use client'

/** Village-hall easter egg when 30 is called. */
export function DirtyGirty({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="girty" role="status" aria-live="polite">
      <p className="girty-kicker">Number thirty!</p>
      <p className="girty-line">Dirty Girty from Number 30</p>
    </div>
  )
}
