export type BingoMode = 75 | 90

export interface BingoState {
  mode: BingoMode
  called: number[]
  /** When true, Caller hides code/QR and all Displays hide the hall QR. */
  joinHidden: boolean
  updatedAt: number
}

export const STORAGE_KEY = 'ancrum-fete-bingo-state'
export const CHANNEL_NAME = 'ancrum-fete-bingo'
export const ROOM_STORAGE_KEY = 'ancrum-fete-bingo-room'

export const DEFAULT_STATE: BingoState = {
  mode: 90,
  called: [],
  joinHidden: false,
  updatedAt: 0,
}

export function maxBall(mode: BingoMode): number {
  return mode
}

export function lastCalled(state: BingoState): number | null {
  return state.called.length ? state.called[state.called.length - 1]! : null
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z2-9]{4}$/.test(code)
}
