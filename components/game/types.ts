export type BingoMode = 75 | 90

export type HallAlertKind = 'bingo' | 'full_house'

export interface HallAlert {
  kind: HallAlertKind
  /** Unique per press so Display/Mobile can re-fire the same kind. */
  id: number
}

export interface BingoState {
  mode: BingoMode
  called: number[]
  /** When true, Caller hides code/QR and all Displays hide the hall QR. */
  joinHidden: boolean
  /** Caller Bingo / Full House flash for Display + Mobile. */
  hallAlert: HallAlert | null
  updatedAt: number
}

export const STORAGE_KEY = 'ancrum-fete-bingo-state'
export const CHANNEL_NAME = 'ancrum-fete-bingo'
export const ROOM_STORAGE_KEY = 'ancrum-fete-bingo-room'

export const DEFAULT_STATE: BingoState = {
  mode: 90,
  called: [],
  joinHidden: false,
  hallAlert: null,
  updatedAt: 0,
}

export function parseHallAlert(raw: unknown): HallAlert | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const kind = obj.kind === 'bingo' || obj.kind === 'full_house' ? obj.kind : null
  const id = typeof obj.id === 'number' && Number.isFinite(obj.id) ? obj.id : null
  if (!kind || id === null) return null
  return { kind, id }
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
