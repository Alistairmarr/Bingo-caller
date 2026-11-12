import { NextResponse } from 'next/server'
import { createRoom } from '@/lib/rooms'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { state?: unknown } = {}
  try {
    body = (await request.json()) as { state?: unknown }
  } catch {
    body = {}
  }
  try {
    const created = await createRoom(body.state)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create_failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
