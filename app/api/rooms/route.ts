import { NextResponse } from 'next/server'
import { getOrCreateHallRoom } from '@/lib/rooms'

export const runtime = 'nodejs'

/** Opens the single Ancrum hall room (get-or-create). */
export async function POST(request: Request) {
  let body: { state?: unknown } = {}
  try {
    body = (await request.json()) as { state?: unknown }
  } catch {
    body = {}
  }
  try {
    const room = await getOrCreateHallRoom(body.state)
    return NextResponse.json(room, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
