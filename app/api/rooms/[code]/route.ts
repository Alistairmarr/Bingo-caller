import { NextResponse } from 'next/server'
import { rateLimit, readCallerToken, readJsonBody } from '@/lib/http'
import { getRoom, isValidCode, putRoom } from '@/lib/rooms'

export const runtime = 'nodejs'

type Params = { params: Promise<{ code: string }> }

export async function GET(request: Request, { params }: Params) {
  const limited = rateLimit(request, 'rooms-read')
  if (limited) return limited

  const { code: raw } = await params
  const code = raw.toUpperCase()
  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }
  const state = await getRoom(code)
  if (!state) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  // Cheap Display polls: unchanged updatedAt → 304 (no JSON body).
  const etag = `"${code}-${state.updatedAt}"`
  const inm = request.headers.get('if-none-match')?.trim()
  if (inm && inm === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'no-store',
      },
    })
  }
  return NextResponse.json(
    { code, state },
    {
      headers: {
        ETag: etag,
        'Cache-Control': 'no-store',
      },
    },
  )
}

export async function PUT(request: Request, { params }: Params) {
  const limited = rateLimit(request, 'rooms-write')
  if (limited) return limited

  const { code: raw } = await params
  const code = raw.toUpperCase()
  if (!isValidCode(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }

  const parsed = await readJsonBody(request)
  if (!parsed.ok) return parsed.response
  const body = (parsed.value && typeof parsed.value === 'object' ? parsed.value : {}) as {
    state?: unknown
    callerToken?: unknown
  }
  const token = readCallerToken(request, body)
  const result = await putRoom(code, body.state, token)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status || 400 })
  }
  return NextResponse.json({ code, state: result.state })
}
