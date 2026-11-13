import { NextResponse } from 'next/server'
import { rateLimit, readCallerPin, readCallerToken, readJsonBody } from '@/lib/http'
import { getOrCreateHallRoom } from '@/lib/rooms'

export const runtime = 'nodejs'

/** Opens the single Ancrum hall room. PIN required to mint/reclaim Caller token; Display uses GET. */
export async function POST(request: Request) {
  const limited = rateLimit(request, 'rooms-claim')
  if (limited) return limited

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const body = (parsed.value && typeof parsed.value === 'object' ? parsed.value : {}) as {
    state?: unknown
    callerToken?: unknown
    callerPin?: unknown
  }
  const presented = readCallerToken(request, body)
  const pin = readCallerPin(request, body)

  try {
    const room = await getOrCreateHallRoom(body.state, presented, pin)
    if (!room.ok) {
      const status =
        room.error === 'bad_pin' ? 401 : room.error === 'pin_not_configured' ? 503 : 403
      return NextResponse.json({ error: room.error, code: room.code, state: room.state }, { status })
    }
    return NextResponse.json(
      { code: room.code, state: room.state, callerToken: room.callerToken },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
