import { NextResponse } from 'next/server'
import { getRoom, isValidCode, putRoom } from '@/lib/rooms'

export const runtime = 'nodejs'

type Params = { params: Promise<{ code: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { code: raw } = await params
  const code = raw.toUpperCase()
  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }
  const state = await getRoom(code)
  if (!state) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ code, state })
}

export async function PUT(request: Request, { params }: Params) {
  const { code: raw } = await params
  const code = raw.toUpperCase()
  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }
  let body: { state?: unknown }
  try {
    body = (await request.json()) as { state?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const result = await putRoom(code, body.state)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 })
  }
  return NextResponse.json({ code, state: result.state, stale: !!result.stale })
}
