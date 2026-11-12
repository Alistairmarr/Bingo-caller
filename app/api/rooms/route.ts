import { NextResponse } from 'next/server'
import { rateLimit, readCallerToken, readJsonBody } from '@/lib/http'
import { getOrCreateHallRoom } from '@/lib/rooms'

export const runtime = 'nodejs'

/** Opens the single Ancrum hall room (get-or-create) and returns a caller token. */
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
    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
