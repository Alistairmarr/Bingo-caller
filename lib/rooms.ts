import { sql } from '@/lib/db'

/** Single hall room for Ancrum Fete — no multi-room create. */
export const HALL_ROOM_CODE = 'FETE'

export type BingoMode = 75 | 90

export interface BingoState {
  mode: BingoMode
  called: number[]
  updatedAt: number
}

export function isValidCode(code: string): boolean {
  return typeof code === 'string' && /^[A-Z2-9]{4}$/.test(code)
}

export function normalizeState(raw: unknown): BingoState | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const mode = obj.mode === 75 || obj.mode === 90 ? obj.mode : 90
  const called = Array.isArray(obj.called)
    ? obj.called
        .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= mode)
        .slice(0, mode)
    : []
  const updatedAt = typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : Date.now()
  return { mode, called, updatedAt }
}

type RoomRow = {
  code: string
  mode: number
  called: unknown
  updated_at: number | string
}

function parseCalled(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.filter((n): n is number => typeof n === 'number')
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
    } catch {
      return []
    }
  }
  return []
}

function rowToState(row: RoomRow): BingoState {
  return {
    mode: (row.mode === 75 ? 75 : 90) as BingoMode,
    called: parseCalled(row.called),
    updatedAt: Number(row.updated_at),
  }
}

/** Get the one hall room, creating FETE if needed. Ignores client-proposed codes. */
export async function getOrCreateHallRoom(state: unknown): Promise<{ code: string; state: BingoState }> {
  const existingRows = await sql<RoomRow>(
    `select code, mode, called, updated_at from rooms where code = $1`,
    [HALL_ROOM_CODE],
  )
  if (existingRows[0]) {
    return { code: HALL_ROOM_CODE, state: rowToState(existingRows[0]) }
  }

  const next = normalizeState(state) || { mode: 90 as BingoMode, called: [], updatedAt: Date.now() }
  try {
    await sql(`insert into rooms (code, mode, called, updated_at) values ($1, $2, $3::jsonb, $4)`, [
      HALL_ROOM_CODE,
      next.mode,
      JSON.stringify(next.called),
      next.updatedAt,
    ])
    return { code: HALL_ROOM_CODE, state: next }
  } catch {
    const again = await sql<RoomRow>(
      `select code, mode, called, updated_at from rooms where code = $1`,
      [HALL_ROOM_CODE],
    )
    if (again[0]) return { code: HALL_ROOM_CODE, state: rowToState(again[0]) }
    throw new Error('Could not open hall room')
  }
}

/** @deprecated use getOrCreateHallRoom — kept name for API route clarity */
export async function createRoom(state: unknown): Promise<{ code: string; state: BingoState }> {
  return getOrCreateHallRoom(state)
}

export async function getRoom(code: string): Promise<BingoState | null> {
  if (!isValidCode(code)) return null
  const rows = await sql<RoomRow>(
    `select code, mode, called, updated_at from rooms where code = $1`,
    [code],
  )
  if (!rows[0]) return null
  return rowToState(rows[0])
}

export async function putRoom(
  code: string,
  state: unknown,
): Promise<{ state: BingoState; stale?: boolean; error?: string; status?: number }> {
  if (!isValidCode(code)) return { state: { mode: 90, called: [], updatedAt: 0 }, error: 'invalid_code', status: 400 }
  const next = normalizeState(state)
  if (!next) return { state: { mode: 90, called: [], updatedAt: 0 }, error: 'invalid_state', status: 400 }

  const existing = await getRoom(code)
  if (!existing) {
    if (code !== HALL_ROOM_CODE) {
      return { state: { mode: 90, called: [], updatedAt: 0 }, error: 'not_found', status: 404 }
    }
    await sql(`insert into rooms (code, mode, called, updated_at) values ($1, $2, $3::jsonb, $4)`, [
      code,
      next.mode,
      JSON.stringify(next.called),
      next.updatedAt,
    ])
    return { state: next }
  }

  if (next.updatedAt < existing.updatedAt) {
    return { state: existing, stale: true }
  }

  await sql(`update rooms set mode = $2, called = $3::jsonb, updated_at = $4 where code = $1`, [
    code,
    next.mode,
    JSON.stringify(next.called),
    next.updatedAt,
  ])
  return { state: next }
}
