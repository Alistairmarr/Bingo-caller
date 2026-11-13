import type { BingoState } from './types'
import { DEFAULT_STATE, isValidRoomCode } from './types'

export const CALLER_TOKEN_KEY = 'ancrum-fete-bingo-caller-token'

export class CallerPinError extends Error {
  readonly kind: 'pin_required' | 'bad_pin'
  constructor(kind: 'pin_required' | 'bad_pin', message: string) {
    super(message)
    this.kind = kind
    this.name = 'CallerPinError'
  }
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4)
}

export function readCallerToken(): string | null {
  try {
    return sessionStorage.getItem(CALLER_TOKEN_KEY) || localStorage.getItem(CALLER_TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeCallerToken(token: string) {
  try {
    sessionStorage.setItem(CALLER_TOKEN_KEY, token)
    localStorage.setItem(CALLER_TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

async function parseJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function createRoom(
  initial?: BingoState,
  callerPin?: string,
): Promise<{ code: string; state: BingoState; callerToken: string }> {
  const state = initial ?? { ...DEFAULT_STATE, updatedAt: Date.now() }
  const existingToken = readCallerToken()
  const pin = callerPin?.trim() || undefined
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(existingToken ? { 'X-Caller-Token': existingToken } : {}),
      ...(pin ? { 'X-Caller-Pin': pin } : {}),
    },
    body: JSON.stringify({
      state,
      callerToken: existingToken ?? undefined,
      callerPin: pin,
    }),
  })
  const data = await parseJson(res)
  if (data?.error === 'pin_required' || data?.error === 'bad_pin') {
    throw new CallerPinError(
      data.error,
      data.error === 'bad_pin' ? 'Wrong Caller PIN' : 'Caller PIN required',
    )
  }
  if (!res.ok || !data?.code || !data?.callerToken) {
    throw new Error(data?.error || 'Could not create room')
  }
  writeCallerToken(data.callerToken as string)
  return {
    code: data.code as string,
    state: data.state as BingoState,
    callerToken: data.callerToken as string,
  }
}

export async function fetchRoom(code: string): Promise<BingoState | null> {
  const normalized = normalizeRoomCode(code)
  if (!isValidRoomCode(normalized)) return null
  const res = await fetch(`/api/rooms/${normalized}`)
  if (res.status === 404) return null
  const data = await parseJson(res)
  if (!res.ok || !data?.state) throw new Error(data?.error || 'Could not load room')
  return data.state as BingoState
}

export async function pushRoom(code: string, state: BingoState): Promise<BingoState> {
  const normalized = normalizeRoomCode(code)
  if (!isValidRoomCode(normalized)) throw new Error('Invalid room code')
  const token = readCallerToken()
  if (!token) throw new Error('Caller token missing — enter Caller PIN again')
  const res = await fetch(`/api/rooms/${normalized}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Caller-Token': token,
    },
    body: JSON.stringify({ state, callerToken: token }),
  })
  const data = await parseJson(res)
  if (res.status === 401) throw new Error('Caller control lost — enter Caller PIN again')
  if (!res.ok || !data?.state) throw new Error(data?.error || 'Could not update room')
  return data.state as BingoState
}
