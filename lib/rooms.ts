import { randomBytes, timingSafeEqual } from 'node:crypto'
import { sql } from '@/lib/db'

/** Single hall room for Ancrum Fete — no multi-room create. */
export const HALL_ROOM_CODE = 'FETE'

export type BingoMode = 75 | 90

export interface BingoState {
  mode: BingoMode
  called: number[]
  joinHidden: boolean
  updatedAt: number
}

export type OpenHallResult =
  | { ok: true; code: string; state: BingoState; callerToken: string }
  | { ok: false; error: 'caller_locked'; code: string; state: BingoState }

export function isValidCode(code: string): boolean {
  return typeof code === 'string' && /^[A-Z2-9]{4}$/.test(code)
}

/** Parse client game fields; never trust client updatedAt. */
export function normalizeState(raw: unknown): Omit<BingoState, 'updatedAt'> | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const mode = obj.mode === 75 || obj.mode === 90 ? obj.mode : 90
  const called = Array.isArray(obj.called)
    ? obj.called
        .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= mode)
        .slice(0, mode)
    : []
  const joinHidden = obj.joinHidden === true
  return { mode, called, joinHidden }
}

function mintCallerToken(): string {
  return randomBytes(24).toString('base64url')
}

function tokensMatch(expected: string | null | undefined, provided: string | null): boolean {
  if (!expected || !provided) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

type RoomRow = {
  code: string
  mode: number
  called: unknown
  join_hidden?: boolean | null
  caller_token?: string | null
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
    joinHidden: row.join_hidden === true,
    updatedAt: Number(row.updated_at),
  }
}

async function loadHallRow(): Promise<RoomRow | null> {
  const rows = await sql<RoomRow>(
    `select code, mode, called, join_hidden, caller_token, updated_at from rooms where code = $1`,
    [HALL_ROOM_CODE],
  )
  return rows[0] ?? null
}

/**
 * Get-or-create the hall room.
 * Mint only when no caller token exists yet, or when the presented token matches.
 * Never rotate/overwrite for an anonymous visitor.
 */
export async function getOrCreateHallRoom(
  state: unknown,
  presentedToken: string | null,
): Promise<OpenHallResult> {
  const existing = await loadHallRow()
  if (existing) {
    const game = rowToState(existing)
    const current = existing.caller_token?.trim() || ''
    if (!current) {
      const callerToken = mintCallerToken()
      await sql(`update rooms set caller_token = $2 where code = $1`, [HALL_ROOM_CODE, callerToken])
      return { ok: true, code: HALL_ROOM_CODE, state: game, callerToken }
    }
    if (tokensMatch(current, presentedToken)) {
      return { ok: true, code: HALL_ROOM_CODE, state: game, callerToken: current }
    }
    return { ok: false, error: 'caller_locked', code: HALL_ROOM_CODE, state: game }
  }

  const fields = normalizeState(state) || { mode: 90 as BingoMode, called: [], joinHidden: false }
  const updatedAt = Date.now()
  const callerToken = mintCallerToken()
  try {
    await sql(
      `insert into rooms (code, mode, called, join_hidden, caller_token, updated_at) values ($1, $2, $3::jsonb, $4, $5, $6)`,
      [HALL_ROOM_CODE, fields.mode, JSON.stringify(fields.called), fields.joinHidden, callerToken, updatedAt],
    )
    return {
      ok: true,
      code: HALL_ROOM_CODE,
      state: { ...fields, updatedAt },
      callerToken,
    }
  } catch {
    const again = await loadHallRow()
    if (!again) throw new Error('Could not open hall room')
    const game = rowToState(again)
    const current = again.caller_token?.trim() || ''
    if (!current) {
      const minted = mintCallerToken()
      await sql(`update rooms set caller_token = $2 where code = $1`, [HALL_ROOM_CODE, minted])
      return { ok: true, code: HALL_ROOM_CODE, state: game, callerToken: minted }
    }
    if (tokensMatch(current, presentedToken)) {
      return { ok: true, code: HALL_ROOM_CODE, state: game, callerToken: current }
    }
    return { ok: false, error: 'caller_locked', code: HALL_ROOM_CODE, state: game }
  }
}

export async function getRoom(code: string): Promise<BingoState | null> {
  if (!isValidCode(code)) return null
  const rows = await sql<RoomRow>(
    `select code, mode, called, join_hidden, caller_token, updated_at from rooms where code = $1`,
    [code],
  )
  if (!rows[0]) return null
  return rowToState(rows[0])
}

export async function putRoom(
  code: string,
  state: unknown,
  callerToken: string | null,
): Promise<{ state: BingoState; error?: string; status?: number }> {
  if (!isValidCode(code)) {
    return { state: { mode: 90, called: [], joinHidden: false, updatedAt: 0 }, error: 'invalid_code', status: 400 }
  }
  const fields = normalizeState(state)
  if (!fields) {
    return { state: { mode: 90, called: [], joinHidden: false, updatedAt: 0 }, error: 'invalid_state', status: 400 }
  }
  if (code !== HALL_ROOM_CODE) {
    return { state: { mode: 90, called: [], joinHidden: false, updatedAt: 0 }, error: 'not_found', status: 404 }
  }

  const existing = await loadHallRow()
  if (!existing) {
    return { state: { mode: 90, called: [], joinHidden: false, updatedAt: 0 }, error: 'not_found', status: 404 }
  }
  if (!tokensMatch(existing.caller_token, callerToken)) {
    return { state: rowToState(existing), error: 'unauthorized', status: 401 }
  }

  // Server clock only — client updatedAt is ignored so inflated timestamps cannot freeze the room.
  const updatedAt = Date.now()
  const next: BingoState = { ...fields, updatedAt }
  await sql(
    `update rooms set mode = $2, called = $3::jsonb, join_hidden = $4, updated_at = $5 where code = $1`,
    [code, next.mode, JSON.stringify(next.called), next.joinHidden, next.updatedAt],
  )
  return { state: next }
}
