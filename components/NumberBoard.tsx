import type { CSSProperties } from 'react'
import type { BingoMode } from './game/types'
import { maxBall } from './game/types'

interface NumberBoardProps {
  mode: BingoMode
  called: number[]
  highlight?: number | null
  compact?: boolean
}

export function NumberBoard({ mode, called, highlight = null, compact = false }: NumberBoardProps) {
  const total = maxBall(mode)
  const calledSet = new Set(called)
  const cols = 10
  const rows = Math.ceil(total / cols)

  return (
    <div
      className={`number-board ${compact ? 'number-board--compact' : ''}`}
      style={{ '--board-cols': cols, '--board-rows': rows } as CSSProperties}
      aria-label={`Called numbers board, ${mode}-ball`}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const isCalled = calledSet.has(n)
        const isHot = highlight === n
        return (
          <span
            key={n}
            className={['ball', isCalled ? 'ball--called' : 'ball--idle', isHot ? 'ball--hot' : '']
              .filter(Boolean)
              .join(' ')}
          >
            {n}
          </span>
        )
      })}
    </div>
  )
}
