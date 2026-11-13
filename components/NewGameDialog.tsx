'use client'

import { useEffect, useRef, useState } from 'react'
import { THEME_COLORS, THEME_LABELS, type ThemeColor } from './game/themes'

export function NewGameDialog({
  open,
  current,
  onCancel,
  onConfirm,
}: {
  open: boolean
  current: ThemeColor
  onCancel: () => void
  onConfirm: (color: ThemeColor) => void
}) {
  const [picked, setPicked] = useState<ThemeColor>(current)
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setPicked(current)
    startRef.current?.focus()
  }, [open, current])

  if (!open) return null

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog dialog--new-game"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-game-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-game-title">New game</h2>
        <p>Clears the board, sets the hall colour, and shows the TV QR so players can prepare.</p>
        <div className="theme-swatches" role="group" aria-label="Game colour">
          {THEME_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`theme-swatch theme-swatch--${color} ${picked === color ? 'theme-swatch--active' : ''}`}
              aria-pressed={picked === color}
              onClick={() => setPicked(color)}
            >
              {THEME_LABELS[color]}
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={startRef}
            type="button"
            className="btn btn-primary"
            onClick={() => onConfirm(picked)}
          >
            Start game
          </button>
        </div>
      </div>
    </div>
  )
}
