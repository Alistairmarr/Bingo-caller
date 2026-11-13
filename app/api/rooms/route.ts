import { NextResponse } from 'next/server'
import { rateLimit, readCallerToken, readJsonBody } from '@/lib/http'
import { getOrCreateHallRoom } from '@/lib/rooms'

export const runtime = 'nodejs'

/** Opens the single Ancrum hall room (get-or-create). Caller token only if unlocked / proven. */
export async function POST(request: Request) {
  const limited = rateLimit(request, 'rooms-write')
  if (limited) return limited

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const body = (parsed.value && typeof parsed.value === 'object' ? parsed.value : {}) as {
    state?: unknown
    callerToken?: unknown
  }
  const presented = readCallerToken(request, body)

  try {
    const room = await getOrCreateHallRoom(body.state, presented)
    if (!room.ok) {
      // Public Display can still GET; do not mint/rotate for strangers.
      return NextResponse.json(
        { error: room.error, code: room.code, state: room.state },
        { status: 403 },
      )
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
