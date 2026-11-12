import type { BingoState } from './types'
import { DEFAULT_STATE, isValidRoomCode } from './types'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomRoomCode(): string {
  const bytes = new Uint32Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]!).join('')
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4)
}

async function parseJson(res: Response) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function createRoom(initial?: BingoState): Promise<{ code: string; state: BingoState }> {
  const state = initial ?? { ...DEFAULT_STATE, updatedAt: Date.now() }
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  })
  const data = await parseJson(res)
  if (!res.ok || !data?.code) {
    throw new Error(data?.error || 'Could not create room')
  }
  return { code: data.code as string, state: data.state as BingoState }
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
  const res = await fetch(`/api/rooms/${normalized}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  })
  const data = await parseJson(res)
  if (!res.ok || !data?.state) throw new Error(data?.error || 'Could not update room')
  return data.state as BingoState
}
