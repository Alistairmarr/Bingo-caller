import { randomBytes, timingSafeEqual } from 'node:crypto'
import { configuredCallerPin, pinMatches } from '@/lib/callerPin'
import { sql } from '@/lib/db'

/** Single hall room for Ancrum Fete — no multi-room create. */
export const HALL_ROOM_CODE = 'FETE'

/** Ancrum Fete is 90-ball only (legacy 75 coerced on read). */
export type BingoMode = 90

export type HallAlertKind = 'bingo' | 'full_house'

export type HallAlertSource = 'caller' | 'checker'

export interface HallAlert {
  kind: HallAlertKind
  id: number
  source: HallAlertSource
}

const THEME_COLORS = ['yellow', 'red', 'lilac', 'brown', 'pink', 'green'] as const
export type ThemeColor = (typeof THEME_COLORS)[number]

export interface BingoState {
  mode: BingoMode
  called: number[]
  joinHidden: boolean
  hallAlert: HallAlert | null
  highContrast: boolean
  themeColor: ThemeColor
  updatedAt: number
}

export type OpenHallResult =
  | { ok: true; code: string; state: BingoState; callerToken: string }
  | {
      ok: false
      error: 'pin_required' | 'bad_pin' | 'pin_not_configured'
      code: string
      state: BingoState | null
    }

export function isValidCode(code: string): boolean {
  return typeof code === 'string' && /^[A-Z2-9]{4}$/.test(code)
}

function parseHallAlert(raw: unknown): HallAlert | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const kind = obj.kind === 'bingo' || obj.kind === 'full_house' ? obj.kind : null
  const id = typeof obj.id === 'number' && Number.isFinite(obj.id) ? obj.id : null
  if (!kind || id === null) return null
  const source: HallAlertSource = obj.source === 'checker' ? 'checker' : 'caller'
  return { kind, id, source }
}

function parseThemeColor(raw: unknown): ThemeColor {
  if (typeof raw !== 'string') return 'green'
  if ((THEME_COLORS as readonly string[]).includes(raw)) return raw as ThemeColor
  if (raw === 'blue') return 'lilac'
  if (raw === 'purple') return 'pink'
  return 'green'
}

/** Parse client game fields; never trust client updatedAt. */
export function normalizeState(raw: unknown): Omit<BingoState, 'updatedAt'> | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const mode: BingoMode = 90
  const called = Array.isArray(obj.called)
    ? obj.called
        .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 90)
        .slice(0, 90)
    : []
  const joinHidden = obj.joinHidden === true
  const hallAlert = parseHallAlert(obj.hallAlert)
  const highContrast = obj.highContrast === true
  const themeColor = parseThemeColor(obj.themeColor)
  return { mode, called, joinHidden, hallAlert, highContrast, themeColor }
}

function emptyState(updatedAt = 0): BingoState {
  return {
    mode: 90,
    called: [],
    joinHidden: false,
    hallAlert: null,
    highContrast: false,
    themeColor: 'green',
    updatedAt,
  }
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
  hall_alert?: unknown
  high_contrast?: boolean | null
  theme_color?: string | null
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
    mode: 90 as BingoMode,
    called: parseCalled(row.called),
    joinHidden: row.join_hidden === true,
    hallAlert: parseHallAlert(row.hall_alert),
    highContrast: row.high_contrast === true,
    themeColor: parseThemeColor(row.theme_color),
    updatedAt: Number(row.updated_at),
  }
}

async function loadHallRow(): Promise<RoomRow | null> {
  const rows = await sql<RoomRow>(
    `select code, mode, called, join_hidden, hall_alert, high_contrast, theme_color, caller_token, updated_at from rooms where code = $1`,
    [HALL_ROOM_CODE],
  )
  return rows[0] ?? null
}

function claimWithPin(
  pin: string | null,
  game: BingoState | null,
): OpenHallResult | { mint: true } {
  if (!configuredCallerPin()) {
    return { ok: false, error: 'pin_not_configured', code: HALL_ROOM_CODE, state: game }
  }
  if (!pin) return { ok: false, error: 'pin_required', code: HALL_ROOM_CODE, state: game }
  if (!pinMatches(pin)) return { ok: false, error: 'bad_pin', code: HALL_ROOM_CODE, state: game }
  return { mint: true }
}

/**
 * Get-or-create the hall room.
 * - Matching caller token → resume (no PIN).
 * - Valid Caller PIN → mint/rotate token (first claim or reclaim).
 * - Otherwise → pin_required / bad_pin (never mint for strangers).
 */
export async function getOrCreateHallRoom(
  state: unknown,
  presentedToken: string | null,
  presentedPin: string | null,
): Promise<OpenHallResult> {
  const existing = await loadHallRow()
  if (existing) {
    const game = rowToState(existing)
    const current = existing.caller_token?.trim() || ''
    if (current && tokensMatch(current, presentedToken)) {
      return { ok: true, code: HALL_ROOM_CODE, state: game, callerToken: current }
    }
    const gate = claimWithPin(presentedPin, game)
    if (!('mint' in gate)) return gate
    const callerToken = mintCallerToken()
    await sql(`update rooms set caller_token = $2 where code = $1`, [HALL_ROOM_CODE, callerToken])
    return { ok: true, code: HALL_ROOM_CODE, state: game, callerToken }
  }

  const gate = claimWithPin(presentedPin, null)
  if (!('mint' in gate)) return gate

  const fields = normalizeState(state) || {
    mode: 90 as BingoMode,
    called: [],
    joinHidden: false,
    hallAlert: null,
    highContrast: false,
    themeColor: 'green' as ThemeColor,
  }
  const updatedAt = Date.now()
  const callerToken = mintCallerToken()
  try {
    await sql(
      `insert into rooms (code, mode, called, join_hidden, hall_alert, high_contrast, theme_color, caller_token, updated_at) values ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9)`,
      [
        HALL_ROOM_CODE,
        fields.mode,
        JSON.stringify(fields.called),
        fields.joinHidden,
        fields.hallAlert ? JSON.stringify(fields.hallAlert) : null,
        fields.highContrast,
        fields.themeColor,
        callerToken,
        updatedAt,
      ],
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
    if (current && tokensMatch(current, presentedToken)) {
      return { ok: true, code: HALL_ROOM_CODE, state: game, callerToken: current }
    }
    const retryGate = claimWithPin(presentedPin, game)
    if (!('mint' in retryGate)) return retryGate
    const minted = mintCallerToken()
    await sql(`update rooms set caller_token = $2 where code = $1`, [HALL_ROOM_CODE, minted])
    return { ok: true, code: HALL_ROOM_CODE, state: game, callerToken: minted }
  }
}

export async function getRoom(code: string): Promise<BingoState | null> {
  if (!isValidCode(code)) return null
  const rows = await sql<RoomRow>(
    `select code, mode, called, join_hidden, hall_alert, high_contrast, theme_color, caller_token, updated_at from rooms where code = $1`,
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
    return { state: emptyState(), error: 'invalid_code', status: 400 }
  }
  const fields = normalizeState(state)
  if (!fields) {
    return { state: emptyState(), error: 'invalid_state', status: 400 }
  }
  if (code !== HALL_ROOM_CODE) {
    return { state: emptyState(), error: 'not_found', status: 404 }
  }

  const existing = await loadHallRow()
  if (!existing) {
    return { state: emptyState(), error: 'not_found', status: 404 }
  }
  if (!tokensMatch(existing.caller_token, callerToken)) {
    return { state: rowToState(existing), error: 'unauthorized', status: 401 }
  }

  // Server clock only — client updatedAt is ignored so inflated timestamps cannot freeze the room.
  const updatedAt = Date.now()
  const next: BingoState = { ...fields, updatedAt }
  await sql(
    `update rooms set mode = $2, called = $3::jsonb, join_hidden = $4, hall_alert = $5::jsonb, high_contrast = $6, theme_color = $7, updated_at = $8 where code = $1`,
    [
      code,
      next.mode,
      JSON.stringify(next.called),
      next.joinHidden,
      next.hallAlert ? JSON.stringify(next.hallAlert) : null,
      next.highContrast,
      next.themeColor,
      next.updatedAt,
    ],
  )
  return { state: next }
}

/** Checker (or open hall) may raise Bingo / Full House without the Caller token — alert only. */
export async function putHallAlertOnly(
  code: string,
  kind: HallAlertKind,
  source: HallAlertSource = 'checker',
): Promise<{ state: BingoState; error?: string; status?: number }> {
  if (!isValidCode(code)) {
    return { state: emptyState(), error: 'invalid_code', status: 400 }
  }
  if (kind !== 'bingo' && kind !== 'full_house') {
    return { state: emptyState(), error: 'invalid_kind', status: 400 }
  }
  if (code !== HALL_ROOM_CODE) {
    return { state: emptyState(), error: 'not_found', status: 404 }
  }
  const existing = await loadHallRow()
  if (!existing) {
    return { state: emptyState(), error: 'not_found', status: 404 }
  }
  const prev = rowToState(existing)
  const updatedAt = Date.now()
  const hallAlert: HallAlert = { kind, id: updatedAt, source }
  const next: BingoState = { ...prev, hallAlert, updatedAt }
  await sql(`update rooms set hall_alert = $2::jsonb, updated_at = $3 where code = $1`, [
    code,
    JSON.stringify(hallAlert),
    updatedAt,
  ])
  return { state: next }
}
