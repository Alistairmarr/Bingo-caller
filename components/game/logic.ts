import type { BingoMode, BingoState } from './types'
import { maxBall } from './types'

export function createPool(mode: BingoMode): number[] {
  const n = maxBall(mode)
  return Array.from({ length: n }, (_, i) => i + 1)
}

function randomIndex(length: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0]! % length
  }
  return Math.floor(Math.random() * length)
}

export function nextNumber(state: BingoState): BingoState {
  const pool = createPool(state.mode).filter((n) => !state.called.includes(n))
  if (pool.length === 0) return state
  const pick = pool[randomIndex(pool.length)]!
  return {
    ...state,
    called: [...state.called, pick],
    updatedAt: Date.now(),
  }
}

export function undoLast(state: BingoState): BingoState {
  if (state.called.length === 0) return state
  return {
    ...state,
    called: state.called.slice(0, -1),
    updatedAt: Date.now(),
  }
}

export function clearCalled(state: BingoState): BingoState {
  return {
    ...state,
    called: [],
    updatedAt: Date.now(),
  }
}

export function setMode(state: BingoState, mode: BingoMode): BingoState {
  if (state.mode === mode) return state
  return {
    mode,
    called: [],
    updatedAt: Date.now(),
  }
}

export function remainingCount(state: BingoState): number {
  return maxBall(state.mode) - state.called.length
}
