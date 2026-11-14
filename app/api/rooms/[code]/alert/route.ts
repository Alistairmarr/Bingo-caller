import { NextResponse } from 'next/server'
import { rateLimit, readJsonBody } from '@/lib/http'
import { isValidCode, putHallAlertOnly, type HallAlertKind } from '@/lib/rooms'

export const runtime = 'nodejs'

type Params = { params: Promise<{ code: string }> }

/** Checker raises Bingo / Full House — updates hallAlert only (no Caller token). */
export async function POST(request: Request, { params }: Params) {
  const limited = rateLimit(request, 'rooms-alert')
  if (limited) return limited

  const { code: raw } = await params
  const code = raw.toUpperCase()
  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const body = (parsed.value && typeof parsed.value === 'object' ? parsed.value : {}) as {
    kind?: unknown
  }
  const kind = body.kind === 'bingo' || body.kind === 'full_house' ? (body.kind as HallAlertKind) : null
  if (!kind) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 })
  }

  const result = await putHallAlertOnly(code, kind, 'checker')
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 })
  }
  return NextResponse.json({ code, state: result.state })
}
