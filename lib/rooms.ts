import { sql } from '@/lib/db'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type BingoMode = 75 | 90

export interface BingoState {
  mode: BingoMode
  called: number[]
  updatedAt: number
}

export function isValidCode(code: string): boolean {
  return typeof code === 'string' && /^[A-Z2-9]{4}$/.test(code)
}

function randomCode(): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]!
  }
  return code
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

export async function createRoom(state: unknown): Promise<{ code: string; state: BingoState }> {
  const next = normalizeState(state) || { mode: 90 as BingoMode, called: [], updatedAt: Date.now() }
  for (let i = 0; i < 24; i++) {
    const code = randomCode()
    try {
      await sql(
        `insert into rooms (code, mode, called, updated_at) values ($1, $2, $3::jsonb, $4)`,
        [code, next.mode, JSON.stringify(next.called), next.updatedAt],
      )
      return { code, state: next }
    } catch {
      /* collision — retry */
    }
  }
  throw new Error('Could not allocate room code')
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
