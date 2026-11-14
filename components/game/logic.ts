import type { BingoMode, BingoState, HallAlertKind, ThemeColor } from './types'
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
    // First call ends prep — hide TV QR (and room code) for the live board
    joinHidden: true,
    // Next also clears Bingo / Full House so calling can continue without a separate dismiss
    hallAlert: null,
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

export function setJoinHidden(state: BingoState, joinHidden: boolean): BingoState {
  if (state.joinHidden === joinHidden) return state
  return {
    ...state,
    joinHidden,
    updatedAt: Date.now(),
  }
}

export function setHallAlert(state: BingoState, kind: HallAlertKind): BingoState {
  return {
    ...state,
    hallAlert: { kind, id: Date.now() },
    updatedAt: Date.now(),
  }
}

export function clearHallAlert(state: BingoState): BingoState {
  if (!state.hallAlert) return state
  return {
    ...state,
    hallAlert: null,
    updatedAt: Date.now(),
  }
}

export function setHighContrast(state: BingoState, highContrast: boolean): BingoState {
  if (state.highContrast === highContrast) return state
  return {
    ...state,
    highContrast,
    updatedAt: Date.now(),
  }
}

/** Start a fresh game with a chosen hall colour — clears calls/alerts and reveals QR for prep. */
export function startNewGame(state: BingoState, themeColor: ThemeColor): BingoState {
  return {
    ...state,
    mode: 90,
    called: [],
    hallAlert: null,
    joinHidden: false,
    themeColor,
    updatedAt: Date.now(),
  }
}

export function remainingCount(state: BingoState): number {
  return maxBall(state.mode) - state.called.length
}
